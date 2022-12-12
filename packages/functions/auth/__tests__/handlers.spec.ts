import middy from '@middy/core'
import { faker } from '@faker-js/faker'
import { UserAction } from '@layers/prisma'
import {
  PreSignUpTriggerEvent,
  BasePostConfirmationTriggerEvent,
  BaseCustomEmailSenderTriggerEvent,
  PreTokenGenerationTriggerEvent,
} from 'aws-lambda'
import { Response } from '@layers/core/lib/response'
import { UserService } from '../../user/services'
import * as emailService from '../../email/services'

type EventType = BasePostConfirmationTriggerEvent<string>
type CustomEmailSenderEvent = BaseCustomEmailSenderTriggerEvent<string>

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  user: {
    create: jest.fn(() => Promise.resolve({ id: '910d3111-af05-454c-859c-2c652b49e738' })),
    findFirst: jest.fn(() => Promise.resolve()),
  },
  userHistory: {
    create: jest.fn(() => Promise.resolve()),
  },
}

const sendEmailMock = jest.spyOn(emailService, 'sendEmail')
const createBrazeUserMock = jest.spyOn(emailService, 'createBrazeUser')

const userService = Object.getPrototypeOf(new UserService(prismaClient))
const getUserSpy = jest.spyOn(userService, 'getUser')
const createUserHistorySpy = jest.spyOn(userService, 'createUserHistory')
const createNewUserSpy = jest.spyOn(userService, 'createNewUser')

jest.mock('@layers/prisma', () => ({
  ...jest.requireActual('@layers/prisma'),
  createPrismaCLient: () => prismaClient,
}))
jest.mock('@layers/core/lib/handler', () => ({
  ...jest.requireActual('@layers/core/lib/handler'),
  createHandler: middy,
}))

jest.mock('../../amplitude/services', () => ({
  ...jest.requireActual('../../amplitude/services'),
  sendAmplitudeEvent: jest.fn(() => Promise.resolve()),
}))

jest.mock('cdk/lib/env', () => ({
  KMS_KEY_ALIAS: 'arn:aws:kms:us-west-2:658956600833:alias/EncryptDecrypt',
  KMS_KEY_ARN: 'arn:aws:kms:us-west-2:658956600833:key/b3537ef1-d8dc-4780-9f5a-55776cbb2f7f',
}))

const mCognitoIdentityServiceProvider = {
  adminUpdateUserAttributes: jest.fn().mockReturnThis(),
  listUsers: jest.fn().mockReturnThis(),
  adminLinkProviderForUser: jest.fn().mockReturnThis(),
  adminCreateUser: jest.fn().mockReturnThis(),
  adminSetUserPassword: jest.fn().mockReturnThis(),
  promise: jest.fn(),
}
jest.mock('aws-sdk', () => {
  return {
    CognitoIdentityServiceProvider: jest.fn(() => mCognitoIdentityServiceProvider),
  }
})
const ctx: any = { res: new Response(), prisma: prismaClient }

describe('auth/handlers.ts', () => {
  const userId = faker.datatype.uuid()
  const deviceId = faker.datatype.uuid()
  const user = {
    id: userId,
    email: faker.internet.email(),
    name: faker.name.fullName(),
    isActive: true,
    deleteAt: null,
  }

  beforeEach(() => {
    sendEmailMock.mockReset()
    createBrazeUserMock.mockReset()
    createNewUserSpy.mockReset()
    mCognitoIdentityServiceProvider.promise.mockReset()
  })

  describe('Post Confirmation', () => {
    it('Return Post Confirmation event', async () => {
      createNewUserSpy.mockResolvedValue(user)

      const { cognitoUserConfirmed } = await import('../handlers')
      const event: Partial<EventType> = {
        triggerSource: 'PostConfirmation_ConfirmSignUp',
        request: {
          userAttributes: { name: 'test', given_name: 'Unit', family_name: 'Test', email: user.email, sub: user.id },
        },
      }
      const resp = await cognitoUserConfirmed.handler(event as EventType, ctx)
      expect(resp).toEqual(event)
      expect(createNewUserSpy).toHaveBeenCalled()
    })
  })

  describe('cognitoPreSignUp', () => {
    it('Return event - do not have cognito native account', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Google_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', given_name: 'Unit', family_name: 'Test', email: 'unit@test.com' },
        },
      }
      const expectedResult = Object.assign(
        {},
        { ...event },
        { response: { autoConfirmUser: true, autoVerifyEmail: true } },
      )
      mCognitoIdentityServiceProvider.promise
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          User: { Attributes: [{ Name: 'sub', Value: '26ea61cd-cbfd-4e5e-8406-9d6c07845b29' }] },
        })
        .mockResolvedValue({})

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(expectedResult)
    })

    it('Return event - do not have cognito native account - missing sub attr after creating', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Google_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', given_name: 'Unit', family_name: 'Test', email: 'unit@test.com' },
        },
      }
      const expectedResult = Object.assign(
        {},
        { ...event },
        { response: { autoConfirmUser: true, autoVerifyEmail: true } },
      )
      mCognitoIdentityServiceProvider.promise
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          User: { Attributes: [{ Name: 'first_name', Value: '26ea61cd-cbfd-4e5e-8406-9d6c07845b29' }] },
        })
        .mockResolvedValue({})

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(expectedResult)
    })

    it('Return event - do not have cognito native account - missing User.Attributes in response', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Google_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', given_name: 'Unit', family_name: 'Test', email: 'unit@test.com' },
        },
      }
      const expectedResult = Object.assign(
        {},
        { ...event },
        { response: { autoConfirmUser: true, autoVerifyEmail: true } },
      )
      mCognitoIdentityServiceProvider.promise
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ User: { Username: 'unit@test.com' } })
        .mockResolvedValue({})

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(expectedResult)
    })

    it('Return event - do not have cognito native account - missing User in response', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Google_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', given_name: 'Unit', family_name: 'Test', email: 'unit@test.com' },
        },
      }
      const expectedResult = Object.assign(
        {},
        { ...event },
        { response: { autoConfirmUser: true, autoVerifyEmail: true } },
      )
      mCognitoIdentityServiceProvider.promise.mockResolvedValue({})

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(expectedResult)
    })

    it('Return event - already have cognito native account', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Apple_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', email: 'unit@test.com' },
        },
      }
      const userName = 'unit@test.com'
      mCognitoIdentityServiceProvider.promise.mockResolvedValue({ Users: [{ Username: userName }] })

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(event)
    })

    it('Return event - already have cognito native account - do not have Username as result', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Apple_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', email: 'unit@test.com' },
        },
      }
      mCognitoIdentityServiceProvider.promise.mockResolvedValue({ Users: [{}] })

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(event)
    })

    it('Return event - already have cognito native account - link user throw error', async () => {
      const { cognitoPreSignUp } = await import('../handlers')
      const event: Partial<PreSignUpTriggerEvent> = {
        userPoolId: 'userPoolId',
        userName: 'Apple_1147527301736',
        triggerSource: 'PreSignUp_ExternalProvider',
        request: {
          userAttributes: { name: 'test', email: 'unit@test.com' },
        },
      }
      const userName = 'unit@test.com'
      mCognitoIdentityServiceProvider.promise
        .mockResolvedValueOnce({ Users: [{ UserStatus: 'EXTERNAL_PROVIDER', Username: userName }] })
        .mockRejectedValue('error')

      const resp = await cognitoPreSignUp.handler(event as PreSignUpTriggerEvent, ctx)

      expect(resp).toEqual(event)
    })
  })

  describe('cognitoPreToken', () => {
    const event: Partial<PreTokenGenerationTriggerEvent> = {
      userPoolId: faker.datatype.string(),
      userName: faker.datatype.string(),
      request: { userAttributes: { email_verified: 'false', identities: 'Google' }, groupConfiguration: {} },
    }

    it('should update email_verified attribute successfully', async () => {
      mCognitoIdentityServiceProvider.promise.mockResolvedValueOnce({})
      const { cognitoPreToken } = await import('../handlers')
      const resp = await cognitoPreToken.handler(event as PreTokenGenerationTriggerEvent, ctx)

      expect(resp).toEqual(event)
    })

    it('should return event since email_verified attribute was true', async () => {
      mCognitoIdentityServiceProvider.promise.mockResolvedValueOnce({})
      const emailAlreadyVerifiedEvent: Partial<PreTokenGenerationTriggerEvent> = {
        ...event,
        request: { userAttributes: { email_verified: 'true', identities: 'Google' }, groupConfiguration: {} },
      }

      const { cognitoPreToken } = await import('../handlers')
      const resp = await cognitoPreToken.handler(emailAlreadyVerifiedEvent as PreTokenGenerationTriggerEvent, ctx)

      expect(resp).toEqual(emailAlreadyVerifiedEvent)
      expect(mCognitoIdentityServiceProvider.promise).not.toHaveBeenCalled()
    })

    it('should return event since identities is empty', async () => {
      mCognitoIdentityServiceProvider.promise.mockResolvedValueOnce({})
      const emptyIdentitiesEvent: Partial<PreTokenGenerationTriggerEvent> = {
        ...event,
        request: { userAttributes: { email_verified: 'true' }, groupConfiguration: {} },
      }

      const { cognitoPreToken } = await import('../handlers')
      const resp = await cognitoPreToken.handler(emptyIdentitiesEvent as PreTokenGenerationTriggerEvent, ctx)

      expect(resp).toEqual(emptyIdentitiesEvent)
      expect(mCognitoIdentityServiceProvider.promise).not.toHaveBeenCalled()
    })
  })

  describe('POST /auth/login', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getUserSpy.mockResolvedValue(undefined)

      const { postAuthLogin } = await import('../handlers')
      const resp = await postAuthLogin.handler(
        {
          meta: { user: { id: user.id }, deviceId },
        } as any,
        ctx,
      )
      expect(resp.statusCode).toEqual(404)
      expect(createUserHistorySpy).not.toHaveBeenCalled()
    })

    it('Returns 401: User in deleting mode', async () => {
      const userDeleteAt = {
        ...user,
        deleteAt: new Date(),
      }
      getUserSpy.mockResolvedValue(userDeleteAt)

      const { postAuthLogin } = await import('../handlers')
      const resp = await postAuthLogin.handler(
        {
          params: { name: userDeleteAt.name },
          meta: { user: { id: user.id }, deviceId },
        } as any,
        ctx,
      )
      expect(resp.statusCode).toEqual(401)
      expect(createUserHistorySpy).not.toHaveBeenCalled()
    })

    it('Return 200: Login registered', async () => {
      getUserSpy.mockResolvedValue(user)

      const { postAuthLogin } = await import('../handlers')
      const resp = await postAuthLogin.handler(
        {
          meta: { user: { id: user.id }, deviceId },
        } as any,
        ctx,
      )
      expect(resp.statusCode).toEqual(200)
      expect(createUserHistorySpy).toHaveBeenCalledWith({
        userId: user.id,
        action: UserAction.LOGIN,
        details: { deviceId },
        deviceId,
      })
    })
  })

  describe('POST /auth/logout', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getUserSpy.mockResolvedValue(undefined)

      const { postAuthLogout } = await import('../handlers')
      const resp = await postAuthLogout.handler(
        {
          meta: { user: { id: user.id }, deviceId },
        } as any,
        ctx,
      )
      expect(resp.statusCode).toEqual(404)
      expect(createUserHistorySpy).not.toHaveBeenCalled()
    })

    it('Returns 401: User in deleting mode', async () => {
      const userDeleteAt = {
        ...user,
        deleteAt: new Date(),
      }
      getUserSpy.mockResolvedValue(userDeleteAt)

      const { postAuthLogout } = await import('../handlers')
      const resp = await postAuthLogout.handler(
        {
          params: { name: userDeleteAt.name },
          meta: { user: { id: user.id }, deviceId },
        } as any,
        ctx,
      )
      expect(resp.statusCode).toEqual(401)
      expect(createUserHistorySpy).not.toHaveBeenCalled()
    })

    it('Return 200: Logout registered', async () => {
      getUserSpy.mockResolvedValue(user)

      const { postAuthLogout } = await import('../handlers')
      const resp = await postAuthLogout.handler(
        {
          meta: { user: { id: user.id }, deviceId },
        } as any,
        ctx,
      )
      expect(resp.statusCode).toEqual(200)
      expect(createUserHistorySpy).toHaveBeenCalledWith({
        userId: user.id,
        action: UserAction.LOGOUT,
        details: { deviceId },
        deviceId,
      })
    })
  })

  describe('cognitoCustomEmailSender', () => {
    it('should send custom email successfully with new user created event', async () => {
      sendEmailMock.mockResolvedValue(undefined)
      createBrazeUserMock.mockResolvedValue(undefined)
      const event: Partial<CustomEmailSenderEvent> = {
        triggerSource: 'CustomEmailSender_SignUp',
        region: 'us-west-2',
        userPoolId: 'us-east-1_LnS...',
        userName: userId,
        request: {
          type: 'customEmailSenderRequestV1',
          code: null,
          userAttributes: {
            sub: userId,
            email_verified: 'true',
            phone_number_verified: 'false',
            phone_number: faker.phone.number(),
            given_name: faker.name.firstName(),
            family_name: faker.name.lastName(),
            email: faker.internet.email(),
          },
        },
      }

      const { cognitoCustomEmailSender } = await import('../handlers')
      await cognitoCustomEmailSender.handler(event as CustomEmailSenderEvent, ctx)

      expect(createBrazeUserMock).toHaveBeenCalledWith(userId, event.request?.userAttributes.email)
      expect(sendEmailMock).toHaveBeenCalledWith(event.triggerSource, userId, [])
    })

    it('should not send custom email since do not support trigger event', async () => {
      sendEmailMock.mockResolvedValue(undefined)
      createBrazeUserMock.mockResolvedValue(undefined)
      const event: Partial<CustomEmailSenderEvent> = {
        triggerSource: 'CustomEmailSender_AccountTakeOverNotification',
        region: 'us-west-2',
        userPoolId: 'us-east-1_LnS...',
        userName: userId,
        request: {
          type: 'customEmailSenderRequestV1',
          code: null,
          userAttributes: {
            sub: userId,
            email_verified: 'true',
            phone_number_verified: 'false',
            phone_number: faker.phone.number(),
            given_name: faker.name.firstName(),
            family_name: faker.name.lastName(),
            email: faker.internet.email(),
          },
        },
      }

      const { cognitoCustomEmailSender } = await import('../handlers')
      await cognitoCustomEmailSender.handler(event as CustomEmailSenderEvent, ctx)

      expect(createBrazeUserMock).not.toBeCalled()
      expect(sendEmailMock).not.toBeCalled()
    })
  })
})
