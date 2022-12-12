import { UserAction } from '@layers/prisma'
import { CreateHandlerOptions } from '@layers/core/lib/handler'
import { CreateHttpHandlerWithAuthOptions } from '@layers/core/lib/http-handler'
import {
  APIGatewayProxyStructuredResultV2,
  PreSignUpTriggerEvent,
  BasePostConfirmationTriggerEvent,
  BaseCustomEmailSenderTriggerEvent,
  PreTokenGenerationTriggerEvent,
} from 'aws-lambda'
import { CognitoIdentityServiceProvider } from 'aws-sdk'
import { AdminSetUserPasswordResponse } from 'aws-sdk/clients/cognitoidentityserviceprovider'
import { set } from 'lodash'
import { UserService } from 'user/services'
import { sendAmplitudeEvent, EventType } from 'amplitude/services'
import { CustomCode } from '@layers/core/lib/code'
import { createBrazeUser, emailTemplateMap, sendEmail } from 'email/services'
import env from 'cdk/lib/env'
import { buildClient, KmsKeyringNode, CommitmentPolicy } from '@aws-crypto/client-node'

type LambdaEvent = BasePostConfirmationTriggerEvent<string>
type CustomEmailSenderEvent = BaseCustomEmailSenderTriggerEvent<string>

export const cognitoUserConfirmed: CreateHandlerOptions<LambdaEvent, LambdaEvent> = {
  name: 'cognitoUserConfirmed',
  withDb: true,
  async handler(event: LambdaEvent, ctx): Promise<LambdaEvent> {
    if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
      const userService = new UserService(ctx.prisma)
      const { userAttributes } = event.request
      const { email } = userAttributes
      const firstName = userAttributes.given_name
      const lastName = userAttributes.family_name

      // Device ID is not available within this callback
      await userService.createNewUser({
        id: userAttributes.sub,
        email,
        name: `${firstName} ${lastName}`,
        isActive: true,
        deviceId: userAttributes.sub,
      })

      console.log(`[User confirmed] > Created user: ${firstName} ${lastName} (${email})`)
    }

    return event
  },
}

export const cognitoPreSignUp: CreateHandlerOptions<PreSignUpTriggerEvent, PreSignUpTriggerEvent> = {
  name: 'cognitoPreSignUp',
  withDb: false,
  async handler(event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> {
    const {
      triggerSource,
      userPoolId,
      userName,
      request: {
        userAttributes: { email, given_name, family_name, name },
      },
    } = event

    // In case of Apple, we only have `name` attribute
    const firstName = given_name ?? name
    const lastName = family_name ?? name

    const cognitoIdp = new CognitoIdentityServiceProvider({
      region: env.RESOURCE_REGION,
    })

    if (triggerSource === 'PreSignUp_ExternalProvider') {
      const usersFilteredByEmail = await cognitoIdp
        .listUsers({ UserPoolId: userPoolId, Filter: `email = "${email}"` })
        .promise()

      const [providerNameValue, providerUserId] = userName.split('_')
      const providerName = providerNameValue.charAt(0).toUpperCase() + providerNameValue.slice(1)

      // user already has cognito account
      if (usersFilteredByEmail.Users && usersFilteredByEmail.Users.length > 0) {
        console.log(`Found existing user with email ${email}`)
        const cognitoUsername =
          usersFilteredByEmail.Users.find((u) => u.UserStatus !== 'EXTERNAL_PROVIDER')?.Username ?? 'unknown'

        await linkUsers(cognitoIdp, userPoolId, cognitoUsername, providerUserId, providerName)
        console.log('Link to existing user successfully')
      } else {
        console.log(`Creating new user with email ${email}`)

        const createdCognitoUser = await cognitoIdp
          .adminCreateUser({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
              {
                Name: 'given_name',
                Value: firstName,
              },
              {
                Name: 'family_name',
                Value: lastName,
              },
              {
                Name: 'email',
                Value: email,
              },
              {
                Name: 'email_verified',
                Value: 'true',
              },
            ],
            DesiredDeliveryMediums: [],
            MessageAction: 'SUPPRESS',
          })
          .promise()
        console.log('Created cognito user')

        await Promise.all([
          adminSetUserPassword(cognitoIdp, userPoolId, email),
          linkUsers(
            cognitoIdp,
            userPoolId,
            createdCognitoUser.User?.Username ?? 'unknown',
            providerUserId,
            providerName,
          ),
        ])
        console.log('Link to new created user successfully')

        set(event, 'response.autoVerifyEmail', true)
        set(event, 'response.autoConfirmUser', true)
      }
    }

    return event
  },
}

async function adminSetUserPassword(
  cognitoIdp: CognitoIdentityServiceProvider,
  userPoolId: string,
  email: string,
): Promise<AdminSetUserPasswordResponse> {
  return cognitoIdp
    .adminSetUserPassword({
      Password: generatePassword(),
      UserPoolId: userPoolId,
      Username: email,
      Permanent: true,
    })
    .promise()
}

async function linkUsers(
  cognitoIdp: CognitoIdentityServiceProvider,
  userPoolId: string,
  cognitoUsername: string,
  providerUserId: string,
  providerName: string,
): Promise<void> {
  try {
    await cognitoIdp
      .adminLinkProviderForUser({
        DestinationUser: {
          ProviderAttributeValue: cognitoUsername,
          ProviderName: 'Cognito',
        },
        SourceUser: {
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: providerUserId,
          ProviderName: providerName,
        },
        UserPoolId: userPoolId,
      })
      .promise()
  } catch (err: any) {
    console.log('Swallow link users error', err)
  }

  await sendAmplitudeEvent({
    event_type: EventType.UserCreated,
    user_id: cognitoUsername,
    user_properties: {
      linCloud: 'enabled',
      userType: providerName,
    },
  })
}

function generatePassword(): string {
  return `${Math.random().toString(36).slice(-8)}42`
}

export const postAuthLogin: CreateHttpHandlerWithAuthOptions = {
  name: 'postAuthLogin',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const user = await userService.getUser(id)

    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    if (user.deleteAt !== null) {
      return ctx.res.Unauthorized(
        JSON.stringify({ message: 'Your account is pending on deletion', code: CustomCode.USER_PENDING_DELETION }),
      )
    }

    await new UserService(ctx.prisma).createUserHistory({
      userId: id,
      action: UserAction.LOGIN,
      details: { deviceId },
      deviceId,
    })

    await sendAmplitudeEvent({
      event_type: EventType.LoggedIn,
      user_id: id,
      device_id: deviceId,
      user_properties: {
        linCloud: 'enabled',
      },
    })

    return ctx.res.Ok({ message: 'Login successful', code: CustomCode.AUTH_LOGIN, data: {} })
  },
}

export const postAuthLogout: CreateHttpHandlerWithAuthOptions = {
  name: 'postAuthLogout',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const user = await userService.getUser(id)

    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    if (user.deleteAt !== null) {
      return ctx.res.Unauthorized(
        JSON.stringify({ message: 'Your account is pending on deletion', code: CustomCode.USER_PENDING_DELETION }),
      )
    }

    await new UserService(ctx.prisma).createUserHistory({
      userId: event.meta.user.id,
      action: UserAction.LOGOUT,
      details: { deviceId },
      deviceId,
    })

    await sendAmplitudeEvent({
      event_type: EventType.LoggedOut,
      user_id: id,
      device_id: deviceId,
      user_properties: {
        linCloud: 'disabled',
      },
    })

    return ctx.res.Ok({ message: 'Logout successful', code: CustomCode.AUTH_LOGOUT, data: {} })
  },
}

export const cognitoPreToken: CreateHandlerOptions<PreTokenGenerationTriggerEvent, PreTokenGenerationTriggerEvent> = {
  name: 'cognitoPreToken',
  withDb: false,
  async handler(event: PreTokenGenerationTriggerEvent): Promise<PreTokenGenerationTriggerEvent> {
    const {
      userPoolId,
      userName,
      request: {
        userAttributes: { email_verified, identities },
      },
    } = event

    const emailVerified = ['true', true].some((value) => value === email_verified)

    if (!identities?.length || emailVerified) {
      return event
    }

    const cognitoIdp = new CognitoIdentityServiceProvider()

    await cognitoIdp
      .adminUpdateUserAttributes({
        UserPoolId: userPoolId,
        Username: userName,
        UserAttributes: [{ Name: 'email_verified', Value: 'true' }],
      })
      .promise()

    return event
  },
}

export const cognitoCustomEmailSender: CreateHandlerOptions<CustomEmailSenderEvent, CustomEmailSenderEvent> = {
  name: 'cognitoCustomEmailSender',
  withDb: false,
  async handler(event: CustomEmailSenderEvent): Promise<CustomEmailSenderEvent> {
    if (!Object.keys(emailTemplateMap).includes(event.triggerSource)) {
      return event
    }

    const {
      code,
      userAttributes: { email },
    } = event.request

    let plainTextCode
    if (code != null) {
      const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT)
      const keyring = new KmsKeyringNode({
        generatorKeyId: env.KMS_KEY_ALIAS,
        keyIds: [env.KMS_KEY_ARN],
      })

      const { plaintext } = await decrypt(keyring, Buffer.from(code, 'base64'))
      plainTextCode = plaintext
    }

    if (event.triggerSource === 'CustomEmailSender_SignUp') {
      await createBrazeUser(event.userName, email)
      console.log('Braze user created')
    }

    await sendEmail(event.triggerSource, event.userName, plainTextCode ? [plainTextCode?.toString()] : [])
    console.log('Email sent')
    return event
  },
}
