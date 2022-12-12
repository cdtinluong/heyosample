import axios from 'axios'
import * as script from '../script'
import { HierarchySelectResult } from '../script'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const hierarchies: HierarchySelectResult[] = [
  {
    id: '79f031cd-7d8b-4282-b92b-9784f35f7caf',
    user_id: '9986f683-757f-4e20-8a1b-acbb7c1e68ae',
    file_id: null,
  },
  {
    id: 'fa8c76c7-0c82-47f4-8cec-adca4df13aca',
    user_id: '9986f683-757f-4e20-8a1b-acbb7c1e68ae',
    file_id: '2c5eef70-6d4f-4f9b-b2f5-d3aa5e7d5f61',
  },
  {
    id: '49765aaf-498c-44fe-a12a-f10e50083ef4',
    user_id: '9986f683-757f-4e20-8a1b-acbb7c1e68ae',
    file_id: 'f51d4a36-72e1-4cfa-a981-d5961753d450',
  },
  {
    id: 'a96c41f1-09b2-4272-8f91-0cca8362b128',
    user_id: '35054061-5eed-4bf8-a6ac-6856b9a8a83e',
    file_id: null,
  },
  {
    id: '10bce2a6-255e-4d81-ac37-a31e6dd3d5be',
    user_id: '35054061-5eed-4bf8-a6ac-6856b9a8a83e',
    file_id: '7cad4244-0190-4e88-bd86-b7000a415bc5',
  },
]

const user = {
  id: '5e08f391-296b-417a-a8de-0bfd4044845d',
  email: 'test@test.com',
}

const orgId1 = '407b6a8d-59ee-4a07-a52a-097543fff64f'
const orgId2 = '731454df-0612-4950-9598-3fdf78bb565e'

const file = {
  id: '4d08d348-2a40-4a98-8b35-bd65298afe50',
}
const fileContent = {
  file_id: '4d08d348-2a40-4a98-8b35-bd65298afe50',
  file_name: 'media.mp3',
}

const client: any = {
  query: jest.fn(),
  release: jest.fn(),
}

const dbPool: any = {
  query: jest.fn(),
  connect: jest.fn(() => client),
  end: jest.fn(),
}

jest.mock('../pg-client', () => ({
  createClient: () => dbPool,
}))

const mS3ClientInstance: any = {
  send: jest.fn(),
}
const mCognitoIdentityProvider = {
  adminDeleteUser: jest.fn().mockReturnThis(),
  promise: jest.fn(),
}
jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  return {
    CognitoIdentityProvider: jest.fn(() => mCognitoIdentityProvider),
  }
})

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn(() => mS3ClientInstance),
    DeleteObjectsCommand: jest.fn(),
  }
})

jest.mock('cdk/lib/env', () => ({
  MRAP_ARN: 'mock_s3_bucket_name',
}))

describe('script/user_deletion/src/index', () => {
  describe('processOrganizations', () => {
    it('should processOrganizations successfully', async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ organization_id: orgId1 }, { organization_id: orgId2 }] })
        .mockResolvedValueOnce({ rows: [{ organization_id: orgId1 }] })
        .mockResolvedValue({})

      await script.processOrganizations(dbPool, [user.id])

      expect(client.query).toBeCalledTimes(4)
    })
  })

  describe('deleteUserFiles', () => {
    it('should run deleteUserFiles successfully', async () => {
      dbPool.query.mockReset().mockResolvedValueOnce({ rows: [{ ...file }] })
      client.query
        .mockReset()
        .mockResolvedValueOnce({ rows: [{ ...fileContent }] })
        .mockResolvedValue({})
      mS3ClientInstance.send.mockResolvedValue({ a: 5 })

      await script.deleteS3UserFiles(dbPool, mS3ClientInstance, [user.id])

      expect(dbPool.query).toBeCalledTimes(1)
      expect(client.query).toBeCalledTimes(1)
    })
  })

  describe('deleteUserInDB', () => {
    it('should run deleteUserData successfully', async () => {
      dbPool.query.mockReset().mockResolvedValue({})

      await script.deleteUserInDB(dbPool, [user.id])

      expect(dbPool.query).toBeCalledTimes(1)
    })
  })

  describe('deleteCognitoUsers', () => {
    it('should run deleteCognitoUsers successfully', async () => {
      await script.deleteCognitoUsers(['test1@email.com', 'test2@email.com'])

      expect(mCognitoIdentityProvider.adminDeleteUser).toBeCalledTimes(2)
    })
  })

  describe('deleteDeletedFilesInS3', () => {
    it('should delete file successfully', async () => {
      mS3ClientInstance.send.mockReset().mockResolvedValue({})
      client.query.mockReset().mockResolvedValue({ rows: [{ ...fileContent }] })

      await script.deleteDeletedFilesInS3(dbPool, mS3ClientInstance, hierarchies)

      expect(client.query).toBeCalledTimes(2)
      expect(mS3ClientInstance.send).toBeCalledTimes(2)
    })
  })

  describe('deleteHierarchiesAndFilesInDB', () => {
    it('should delete files and hierarchies successfully', async () => {
      dbPool.query.mockReset().mockResolvedValue({})

      await script.deleteHierarchiesAndFilesInDB(dbPool, hierarchies)

      expect(client.query).toBeCalledTimes(2)
    })
  })

  describe('updateFileStatus', () => {
    it('should update file status successfully', async () => {
      dbPool.query.mockReset().mockResolvedValue({})

      await script.updateFileStatus(dbPool)

      expect(dbPool.query).toBeCalledTimes(2)
    })
  })

  describe('deleteFileContents', () => {
    it('should delete file contents successfully', async () => {
      mS3ClientInstance.send.mockReset().mockResolvedValue({})
      dbPool.query.mockReset().mockResolvedValue({
        rows: [
          {
            id: '79f031cd-7d8b-4282-b92b-9784f35f7caf',
            file_id: 'fa8c76c7-0c82-47f4-8cec-adca4df13aca',
            name: 'media.dat',
            user_id: '9986f683-757f-4e20-8a1b-acbb7c1e68ae',
          },
        ],
      })

      await script.deleteFileContents(dbPool, mS3ClientInstance)

      expect(dbPool.query).toBeCalledTimes(2)
      expect(mS3ClientInstance.send).toBeCalledTimes(1)
    })

    it('should delete file contents successfully - no deleted file contents', async () => {
      dbPool.query.mockReset().mockResolvedValue({ rows: [] })
      mS3ClientInstance.send.mockReset().mockResolvedValue({})

      await script.deleteFileContents(dbPool, mS3ClientInstance)

      expect(dbPool.query).toBeCalledTimes(1)
      expect(mS3ClientInstance.send).not.toBeCalled()
    })
  })

  describe('sendAutoRenewalEmails', () => {
    const templateId = '79f031cd-7d8b-4282-b92b-9784f35f7cac'
    it('should send renewal email successfully', async () => {
      dbPool.query.mockReset().mockResolvedValue({ rows: [
        { user_id: user.id, expire_at: new Date(), details: { price: 123, currency: 'USD' } }
      ]})
      mockedAxios.post.mockResolvedValue({})
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            count: 1,
            message: 'success',
            templates: [
              {
                email_template_id: templateId,
                template_name: 'Auto_Renewal',
                created_at: '2022-11-22T07:11:06.563Z',
                updated_at: '2022-11-22T07:11:06.563Z',
                tags: [],
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            email_template_id: templateId,
            template_name: 'Auto_Renewal',
            description: '',
            subject: 'Verifying your account',
            preheader: '',
            body: '<!DOCTYPE html>\n<html>\n  <header>\n    <title>hello</title>\n  </header>\n  <body>\n    <table>\n      <tr>\n        <td>Welcome to linearity!</td>\n      </tr>\n      <tr>\n        <td>Please click the link below to verify your new email address:</td>\n      </tr>\n      <tr>\n        <td>{{amount}}</td>\n      </tr>\n    </table>\n  </body>\n  \n \n  \n</html>',
            plaintext_body: null,
            should_inline_css: true,
            tags: [],
            created_at: '2022-11-22T07:11:06.563+00:00',
            updated_at: '2022-11-22T08:51:16.768+00:00',
            message: 'success',
          },
        })

      await script.sendAutoRenewalEmails(dbPool)

      expect(dbPool.query).toBeCalledTimes(1)
      expect(mockedAxios.get).toBeCalledTimes(2)
      expect(mockedAxios.post).toBeCalledTimes(1)
    })

    it('should send renewal email failed - cannot find email template', async () => {
      dbPool.query.mockReset()
      mockedAxios.post.mockReset()
      mockedAxios.get
        .mockReset()
        .mockResolvedValueOnce({
          data: {
            count: 1,
            message: 'success',
            templates: [
              {
                email_template_id: templateId,
                template_name: 'Auto_Renewal abc',
                created_at: '2022-11-22T07:11:06.563Z',
                updated_at: '2022-11-22T07:11:06.563Z',
                tags: [],
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            email_template_id: templateId,
            template_name: 'Auto_Renewal',
            description: '',
            subject: 'Verifying your account',
            preheader: '',
            body: '<!DOCTYPE html>\n<html>\n  <header>\n    <title>hello</title>\n  </header>\n  <body>\n    <table>\n      <tr>\n        <td>Welcome to linearity!</td>\n      </tr>\n      <tr>\n        <td>Please click the link below to verify your new email address:</td>\n      </tr>\n      <tr>\n        <td>{{amount}}</td>\n      </tr>\n    </table>\n  </body>\n  \n \n  \n</html>',
            plaintext_body: null,
            should_inline_css: true,
            tags: [],
            created_at: '2022-11-22T07:11:06.563+00:00',
            updated_at: '2022-11-22T08:51:16.768+00:00',
            message: 'success',
          },
        })

      return script.sendAutoRenewalEmails(dbPool).catch((err) => {
        expect(err).toBeDefined()
        expect(dbPool.query).not.toBeCalled()
        expect(mockedAxios.get).toBeCalledTimes(1)
        expect(mockedAxios.post).not.toBeCalled()
      })
    })
  })
})
