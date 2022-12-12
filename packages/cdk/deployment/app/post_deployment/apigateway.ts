/* eslint-disable no-void */
import path from 'path'

import SwaggerParser from '@apidevtools/swagger-parser'
import async from 'async'
import AWS from 'aws-sdk'
import { OpenAPIV3 } from 'openapi-types'
import { hasOwnProperty } from 'cdk/lib/utils'
import { fixOpenApiDefinition } from 'cdk/lib/apigateway/nullable'
import env from 'cdk/lib/env'

interface ParameterHeader {
  in: string
  name: string
  required: boolean
  schema: SchemaHeader
  description?: string
  example?: string
}

interface SchemaHeader {
  type: string
  pattern?: string
}

// Cognito is only located into the region below
const cognitoISP = new AWS.CognitoIdentityServiceProvider({
  region: env.RESOURCE_REGION,
})

const stackName = env.STACK_NAME
const resourceStackName = env.RESOURCE_STACK_NAME
if (stackName == null) throw new Error('STACK_NAME is required')
if (resourceStackName == null) throw new Error('RESOURCE_STACK_NAME is required')

// const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../../..')

const apiFileLookupTable: {
  [key: string]: {
    file: string
  }
} = {
  [`${stackName}-lincloud`]: { file: 'docs/lincloud.yml' },
}

async function getAllApiGatewaysByStackName(APIGateway: AWS.APIGateway) {
  const gws = await APIGateway.getRestApis().promise()

  if (!Array.isArray(gws.items)) throw new Error('Could not load API-Gateways')
  return gws.items.filter((g) => g.tags?.Application === stackName)
}

async function getUserPool() {
  const userPools = await cognitoISP
    .listUserPools({
      MaxResults: 20,
    })
    .promise()

  if (!Array.isArray(userPools.UserPools)) throw new Error('Could not load User Pools')

  const userPoolElement = userPools.UserPools.find((element) => element.Name === `${resourceStackName}-UserPool`)
  if (userPoolElement === undefined) throw new Error('No User Pool found')

  const userPool = await cognitoISP
    .describeUserPool({
      UserPoolId: userPoolElement.Id ?? '',
    })
    .promise()
  if (userPool.UserPool == null) throw new Error('Could not load User Pool')

  return userPool.UserPool
}

export async function run(region: string) {
  console.info(`Start to proceed with ${region}`)
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const APIGateway = new AWS.APIGateway({
    region,
  })
  const apiGateways = await getAllApiGatewaysByStackName(APIGateway)
  const userPool = await getUserPool()
  const promises = apiGateways.map(async (gw) => {
    if (gw.name == null) throw new Error('API-Gateway has no name')
    const gatewayInfo = apiFileLookupTable[gw.name]
    if (gatewayInfo == null) throw new Error(`Could not find file for API-Gateway ${gw.name}, no entry in lookup table`)

    if (gw.id == null) throw new Error('API-Gateway has no id')
    const gatewayId = gw.id
    const refPrefix = `https://apigateway.amazonaws.com/restapis/${gw.id}/models/`
    const filePath = path.resolve(rootDir, gatewayInfo.file)
    const document = await getDocument(filePath)
    const revenueCatSchemaHeader = document.components?.parameters?.RevenueCatAuthorizationHeader as ParameterHeader
    if (revenueCatSchemaHeader !== undefined) {
      revenueCatSchemaHeader.schema.pattern = env.REVENUE_CAT_AUTHORIZER_TOKEN_REGEX
    }

    fixOpenApiDefinition(document, refPrefix)
    // Update document Authorize RevenueCat schema
    const docRevenueCatAuthorize = await APIGateway.getDocumentationParts({
      restApiId: gatewayId,
      type: 'REQUEST_HEADER',
      path: '/webhook/revenuecat',
    }).promise()
    if (docRevenueCatAuthorize.items !== undefined && docRevenueCatAuthorize.items?.length > 0) {
      const promiseUpdateDoc = docRevenueCatAuthorize.items?.map(async (item) =>
        APIGateway.updateDocumentationPart({
          restApiId: gatewayId,
          documentationPartId: item.id ?? '',
          patchOperations: [
            {
              op: 'replace',
              path: '/properties',
              value: JSON.stringify({
                description: revenueCatSchemaHeader.description,
                schema: revenueCatSchemaHeader.schema,
              }),
            },
          ],
        }).promise(),
      )
      await Promise.all(promiseUpdateDoc)
      console.log('Update document Authorize for Webhook RevenueCat')
    }

    // Authorizer
    const authorizers = await APIGateway.getAuthorizers({
      restApiId: gatewayId,
    }).promise()

    if (!Array.isArray(authorizers.items)) throw new Error('Could not load Authorizers')
    // Get the default authorizer
    const authorizer = authorizers.items.find((element) => element.name === 'defaultUserPool')
    if (authorizer === undefined) throw new Error('No default authorizer')
    if (authorizer !== undefined) {
      const userPoolArn = userPool.Arn ?? ''
      // Add proper authorizer
      await APIGateway.updateAuthorizer({
        restApiId: gatewayId,
        authorizerId: authorizer.id ?? '',
        patchOperations: [
          {
            op: 'add',
            path: '/providerARNs',
            value: userPoolArn,
          },
        ],
      }).promise()
      // Remove unnecessary providerARNs
      const providerARNs = authorizer.providerARNs ?? []
      await APIGateway.updateAuthorizer({
        restApiId: gw.id ?? '',
        authorizerId: authorizer.id ?? '',
        patchOperations: providerARNs.map((provider: string) => ({
          op: 'remove',
          path: '/providerARNs',
          value: provider,
        })),
      }).promise()
      console.log(`Update Authorizer ${gatewayId} ${authorizer.name}`)
    }

    // Stages
    const stages = await APIGateway.getStages({
      restApiId: gw.id,
    }).promise()

    if (stages.item == null) throw new Error('API-Gateway has no stages')

    await Promise.all(
      stages.item.map(async (stage) => {
        if (stage.stageName == null) throw new Error('API-Gateway-Stage has no stageName')
        const schemas = document.components?.schemas
        if (schemas == null) throw new Error('No schemas found in the API')

        // eslint-disable-next-line no-restricted-syntax
        for (const key in schemas) {
          if (Object.prototype.hasOwnProperty.call(schemas, key)) {
            const schema = schemas[key]

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await async.retry({}, async () => updateModel(APIGateway, gatewayId, key, schema))
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const newDeploymentId = await async.retry({}, async () =>
          createNewDeployment(APIGateway, gatewayId, stage.stageName ?? ''),
        )

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
        await async.retry({}, async () => updateStage(APIGateway, gatewayId, stage.stageName ?? '', newDeploymentId))
      }),
    )
  })

  await Promise.all(promises)
}

async function updateStage(APIGateway: AWS.APIGateway, restApiId: string, stageName: string, deploymentId: string) {
  const timeout = wait(600)
  await APIGateway.updateStage({
    restApiId,
    stageName,
    patchOperations: [
      {
        op: 'replace',
        path: '/deploymentId',
        value: deploymentId,
      },
      {
        op: 'replace',
        path: '/description',
        value: `deployment ${deploymentId} deployed by pipeline run ${process.env.GITHUB_RUN_NUMBER ?? 'unknown'}`,
      },
    ],
  }).promise()
  await timeout
  console.log(`Updated ${restApiId}/${stageName}`)
}

async function createNewDeployment(APIGateway: AWS.APIGateway, restApiId: string, stageName: string): Promise<string> {
  const timeout = wait(600)
  const newDeployment = await APIGateway.createDeployment({
    restApiId,
    stageName,
    description: `created by pipeline run ${process.env.GITHUB_RUN_NUMBER ?? 'unknown'}`,
  }).promise()
  await timeout
  if (newDeployment.id == null) throw new Error('Could not create new deployment')
  return newDeployment.id
}

async function updateModel(
  APIGateway: AWS.APIGateway,
  restApiId: string,
  modelName: string,
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
) {
  console.log('Update Model', restApiId, modelName)
  const timeout = wait(200)
  const result = await APIGateway.updateModel({
    restApiId,
    modelName,
    patchOperations: [
      {
        op: 'replace',
        path: '/schema',
        value: JSON.stringify(schema, null, 2),
      },
    ],
  }).promise()
  await timeout
  return result
}

// eslint-disable-next-line no-promise-executor-return
const wait = async (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function getDocument(filepath: string): Promise<OpenAPIV3.Document> {
  const api = await SwaggerParser.parse(filepath, {
    dereference: { circular: 'ignore' },
  })
  // console.log('API name: %s, Version: %s', api.info.title, api.info.version);
  if (api.paths == null) throw new Error('No paths found in the API')

  if (!hasOwnProperty(api, 'openapi') || typeof api.openapi !== 'string')
    throw new Error('No openapi version found in the API')

  // Today, 27th July 2022, only 3.0.1 is handled by AWS Cloud Formation...
  if (api.openapi !== '3.0.1') throw new Error('Unsupported openapi version')

  return api as OpenAPIV3.Document
}
