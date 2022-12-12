/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider'
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import env from '@ltv/env'
import { chunk, difference, groupBy, isEmpty } from 'lodash'
import { v4 as uuidV4 } from 'uuid'
import { Pool } from 'pg'
import format from 'pg-format'
import axios, { AxiosResponse } from 'axios'
import { createClient } from './pg-client'

const PARALLEL_LIMIT = 100
const COGNITO_USER_DELETION_LIMIT = 25

interface UserSelectResult {
  id: string
  email: string
}

interface UsersOnOrganizationsSelectResult {
  organization_id: string
}

interface FileSelectResult {
  id: string
}

interface ContentSelectResult {
  file_id: string
  name: string
  version: string
}

export interface HierarchySelectResult {
  id: string
  user_id: string
  file_id: string | null
}

interface FileContentSelect {
  id: string
  file_id: string
  user_id: string
  name: string
  version: string
}

interface Template {
  email_template_id: string
  template_name: string
  created_at: Date
  updated_at: Date
  tags: string[]
}
interface TemplateListResponse {
  count: number
  templates: Template[]
  message: string
}

interface TemplateResponse extends Template {
  description: string
  subject: string
  preheader: string
  body: string
  plaintext_body: string | null
  should_inline_css: boolean
  message: string
}

interface UserPlanDetail {
  price: number
  currency: string
}

interface UserPlanSelect {
  user_id: string
  expire_at: Date
  details: UserPlanDetail
}

const DEFAULT_VERSION = '1'

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${env.string('BRAZE_API_KEY')}`,
}

const BRAZE_ENDPOINT = env.string('BRAZE_REST_ENDPOINT') as string

export async function runScript() {
  const dbPool = await createClient()
  const s3Client = new S3Client({
    region: 'us-west-2',
  })
  const usersResult = await dbPool.query('SELECT id, email FROM "User" WHERE delete_at <= NOW()')
  // process 100 users at a time
  const chunkedUsers = chunk(usersResult.rows, PARALLEL_LIMIT)

  for (const userArr of chunkedUsers) {
    const userIds = userArr.map((user: UserSelectResult) => user.id)
    const emails = userArr.map((user: UserSelectResult) => user.email)

    // Need to execute in order
    await deleteS3UserFiles(dbPool, s3Client, userIds)
    await processOrganizations(dbPool, userIds)
    await Promise.all([deleteUserInDB(dbPool, userIds), deleteCognitoUsers(emails)])
  }

  // Delete Hierarchies, Files
  const hierarchyResult = await dbPool.query('SELECT id, user_id, file_id FROM "Hierarchy" WHERE delete_at <= NOW()')
  await deleteDeletedFilesInS3(dbPool, s3Client, hierarchyResult.rows as HierarchySelectResult[])
  await deleteHierarchiesAndFilesInDB(dbPool, hierarchyResult.rows as HierarchySelectResult[])
  // Update file status
  await updateFileStatus(dbPool)
  await deleteFileContents(dbPool, s3Client)

  // Send auto renewal subscription email
  await sendAutoRenewalEmails(dbPool)

  await dbPool.end()
}

export async function processOrganizations(dbPool: Pool, userIds: string[]) {
  const client = await dbPool.connect()

  const userOrgResult = await client.query(
    `SELECT DISTINCT organization_id FROM "UsersOnOrganizations" WHERE user_id = ANY($1::uuid[])`,
    [userIds],
  )

  const orgIds = userOrgResult.rows.map((org: UsersOnOrganizationsSelectResult) => org.organization_id)

  const userOrgResultNeedInsertHistory = await client.query(
    'SELECT DISTINCT organization_id FROM "UsersOnOrganizations" WHERE user_id != ALL($1::uuid[]) AND organization_id = ANY($2::uuid[])',
    [userIds, orgIds],
  )

  const orgIdsNeedToInsertHistory = userOrgResultNeedInsertHistory.rows.map(
    (org: UsersOnOrganizationsSelectResult) => org.organization_id,
  )

  // finding orgIds which do not have users belong to
  const deletingOrgIds = difference(orgIds, orgIdsNeedToInsertHistory)

  if (deletingOrgIds.length > 0) {
    await client.query('DELETE FROM "Organization" WHERE id = ANY($1::uuid[])', [deletingOrgIds])
  }

  // insert to organizationHistory in case remaining users belong to an organization
  if (orgIdsNeedToInsertHistory.length > 0) {
    const creatingOrgHistories = orgIdsNeedToInsertHistory.map((orgId) => {
      const subArr = []
      subArr.push(uuidV4(), orgId, 'USER_DELETED')

      return subArr
    })

    const queryText = format(
      'INSERT INTO "OrganizationHistory"(id, organization_id, action) VALUES %L',
      creatingOrgHistories,
    )

    await client.query(queryText)
  }
  client.release()
}

export async function deleteUserInDB(dbPool: Pool, ids: string[]): Promise<void> {
  await dbPool.query('DELETE FROM "User" WHERE id = ANY($1::uuid[])', [ids])
}

export async function deleteCognitoUsers(emails: string[]) {
  const cognitoProvider = new CognitoIdentityProvider({})

  const deleteFuncs = emails.map(async (email) =>
    cognitoProvider.adminDeleteUser({
      UserPoolId: env.string('USER_POOL_ID', '') as string,
      Username: email,
    }),
  )

  const chunkedDeleteFuncs = chunk(deleteFuncs, COGNITO_USER_DELETION_LIMIT)

  for (const chunkedFuncs of chunkedDeleteFuncs) {
    await Promise.all(chunkedFuncs)
    await sleep(1200) // wait 1.2 seconds to be sure we don't hit the cognito rate limit
  }
}

async function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

export async function deleteS3UserFiles(dbPool: Pool, s3Client: S3Client, userIds: string[]): Promise<void> {
  const emptyS3DirectoryFuncs = userIds.map(async (userId) => {
    const filesResult = await dbPool.query('SELECT id FROM "File" WHERE user_id = $1', [userId])
    const fileIds = filesResult.rows.map((file: FileSelectResult) => file.id)

    return deleteS3Files(dbPool, s3Client, userId, fileIds)
  })

  const chunkedFuncs = chunk(emptyS3DirectoryFuncs, PARALLEL_LIMIT)

  for (const funcs of chunkedFuncs) {
    await Promise.all(funcs)
  }
}

export async function deleteDeletedFilesInS3(
  dbPool: Pool,
  s3Client: S3Client,
  hierarchySelectResult: HierarchySelectResult[],
) {
  const fileHierarchiesGroupByUserId: Record<string, HierarchySelectResult[]> = groupBy(
    hierarchySelectResult.filter((h: HierarchySelectResult) => h.file_id !== null),
    'user_id',
  )
  if (isEmpty(fileHierarchiesGroupByUserId)) {
    return
  }
  for (const [key, value] of Object.entries(fileHierarchiesGroupByUserId)) {
    // process 100 users at a time
    const chunkedHierarchies = chunk(value, PARALLEL_LIMIT)
    for (const hierarchies of chunkedHierarchies) {
      await deleteS3Files(
        dbPool,
        s3Client,
        key,
        hierarchies.map((hierarchy) => hierarchy.file_id as string),
      )
    }
  }
}

export async function deleteHierarchiesAndFilesInDB(dbPool: Pool, hierarchySelectResult: HierarchySelectResult[]) {
  const hierarchyIds = hierarchySelectResult.map((h) => h.id)
  const fileIds = hierarchySelectResult.map((h) => h.file_id)

  await Promise.all([
    dbPool.query('DELETE FROM "Hierarchy" WHERE id = ANY($1::uuid[])', [hierarchyIds]),
    dbPool.query('DELETE FROM "File" WHERE id = ANY($1::uuid[])', [fileIds]),
  ])
}

async function deleteS3Files(dbPool: Pool, s3Client: S3Client, userId: string, fileIds: string[]): Promise<void> {
  const client = await dbPool.connect()

  const contentsResult = await client.query(
    'SELECT file_id, name, version FROM "FileContent" WHERE file_id = ANY($1::uuid[])',
    [fileIds],
  )
  const contents = contentsResult.rows.map((content: ContentSelectResult) => content)
  client.release()
  const deleteObjects = contents
    .filter((c: ContentSelectResult) => c.version !== DEFAULT_VERSION)
    .map((content) => ({ Key: `${userId}/${content.file_id}/${content.name}` }))
  if (isEmpty(deleteObjects)) {
    return
  }
  const command = new DeleteObjectsCommand({
    Bucket: env.string('MRAP_ARN', '') as string,
    Delete: {
      Objects: deleteObjects,
    },
  })

  await s3Client.send(command)
}

export async function updateFileStatus(dbPool: Pool) {
  await Promise.all([
    dbPool.query(
      `UPDATE "File" SET status = 'FAILED' WHERE status = 'UPLOADING' AND updated_at <= now() - interval '24 hours'`,
    ),
    dbPool.query(
      `UPDATE "FileContent" SET status = 'FAILED' WHERE status = 'UPLOADING' AND updated_at <= now() - interval '24 hours'`,
    ),
  ])
}

export async function deleteFileContents(dbPool: Pool, s3Client: S3Client) {
  const contentsResult = await dbPool.query(
    'SELECT fc.id, fc.file_id, fc.version, fc.name, f.user_id FROM "FileContent" fc join "File" f on f.id = fc.file_id WHERE fc."delete_at" <= NOW()',
  )

  if (contentsResult.rows.length === 0) {
    return
  }
  const deleteObjects = contentsResult.rows
    .filter((c: FileContentSelect) => c.version !== DEFAULT_VERSION)
    .map((fileContent: FileContentSelect) => ({
      Key: `${fileContent.user_id}/${fileContent.file_id}/${fileContent.name}`,
    }))
  if (isEmpty(deleteObjects)) {
    return
  }
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: env.string('MRAP_ARN', '') as string,
      Delete: {
        Objects: deleteObjects,
      },
    }),
  )

  await dbPool.query('DELETE FROM "FileContent" WHERE id = ANY($1::uuid[])', [
    contentsResult.rows.map((c: FileContentSelect) => c.id),
  ])
}

export async function sendAutoRenewalEmails(dbPool: Pool) {
  const templates: AxiosResponse<TemplateListResponse> = await axios.get(`${BRAZE_ENDPOINT}/templates/email/list`, {
    headers,
  })
  const templateId = templates.data.templates.find(
    (template: { template_name: string }) => template.template_name === 'Auto_Renewal',
  )?.email_template_id

  if (templateId === undefined) {
    throw new Error('Cannot find Auto Renewal email template')
  }

  const template: AxiosResponse<TemplateResponse> = await axios.get(
    `${BRAZE_ENDPOINT}/templates/email/info?email_template_id=${templateId}`,
    {
      headers,
    },
  )

  const userPlans = await dbPool.query(
    `SELECT user_id, expire_at, details FROM "UserPlan" WHERE is_active = true and type = 'AUTO_RENEWAL' and expire_at > NOW() + INTERVAL '2 days' and expire_at <= NOW() + INTERVAL '3 days'`,
  )

  const sendEmailFuncs = userPlans.rows.map(async (userPlan: UserPlanSelect) =>
    sendEmail(
      userPlan.user_id,
      template,
      userPlan.expire_at.toLocaleDateString(),
      `${userPlan.details.price} ${userPlan.details.currency}`,
    ),
  )

  await Promise.all(sendEmailFuncs)
}

export async function sendEmail(
  userId: string,
  template: AxiosResponse<TemplateResponse>,
  renewDate: string,
  amount: string,
) {
  let { body } = template.data
  const { subject } = template.data

  body = body.replace('{{renew_date}}', renewDate).replace('{{amount}}', amount)

  await axios.post(
    `${BRAZE_ENDPOINT}/messages/send`,
    {
      external_user_ids: [userId],
      messages: {
        email: {
          app_id: env.string('BRAZE_APP_ID'),
          from: `LinCloud <${env.string('BRAZE_SENDER_EMAIL')}>`,
          reply_to: 'NO_REPLY_TO',
          subject,
          body,
        },
      },
    },
    { headers },
  )
}
