import { Duration, NestedStack, RemovalPolicy } from 'aws-cdk-lib'
import {
  AccountRecovery,
  ClientAttributes,
  StringAttribute,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolIdentityProviderGoogle,
  UserPoolIdentityProviderFacebook,
  UserPoolIdentityProviderApple,
  ProviderAttribute,
  UserPoolEmail,
  OAuthScope,
} from 'aws-cdk-lib/aws-cognito'
import { Key } from 'aws-cdk-lib/aws-kms'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Architecture, LambdaInsightsVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import env from 'cdk/lib/env'
import { createPolicyStatement } from 'cdk/lib/iam/iam'
import { BaseNestedStackProps } from 'cdk/lib/stack.interface'
import { AWS_RESOURCE_TYPE, getNodejsFunctionOptions, normalizeLogicalId, overrideLogicalId } from 'cdk/lib/utils'
import { createPrismaLayer } from 'cdk/lib/lambda/layer'
import { merge } from 'lodash'
import { Construct } from 'constructs'
import path from 'path'
import { ServicePrincipal, PolicyStatement, Effect, ArnPrincipal } from 'aws-cdk-lib/aws-iam'

export class CognitoResourceStack extends NestedStack {
  private userPool!: UserPool

  private userPoolName!: string

  private userPoolClient!: UserPoolClient

  private discourseClient!: UserPoolClient

  public constructor(scope: Construct, id: string, protected props: BaseNestedStackProps) {
    super(scope, id, props)
    const removalPolicy = props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY

    // Create cognito with user pool client
    this.createCognito(removalPolicy)
    const poolClient = this.createUserPoolClient(this.userPool)
    this.userPoolClient = poolClient.userPoolDefaultClient
    this.discourseClient = poolClient.userPoolDiscourseClient
    this.createIdentityProviders()
  }

  public getCognito() {
    return {
      userPool: this.userPool,
      userPoolName: this.userPoolName,
      userPoolClient: this.userPoolClient,
      discourseClient: this.discourseClient,
    }
  }

  private createIdentityProviders() {
    // Create providers social media authentication
    this.userPoolClient.node.addDependency(
      new UserPoolIdentityProviderGoogle(this, 'Google', {
        clientId: env.GOOGLE_APP_ID,
        clientSecret: env.GOOGLE_APP_SECRET,
        userPool: this.userPool,
        scopes: ['profile', 'email', 'openid'],
        attributeMapping: {
          email: ProviderAttribute.GOOGLE_EMAIL,
          givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        },
      }),
    )

    this.userPoolClient.node.addDependency(
      new UserPoolIdentityProviderFacebook(this, 'Facebook', {
        clientId: env.FACEBOOK_APP_ID,
        clientSecret: env.FACEBOOK_APP_SECRET,
        userPool: this.userPool,
        scopes: ['public_profile', 'email'],
        apiVersion: 'v14.0',
        attributeMapping: {
          email: ProviderAttribute.FACEBOOK_EMAIL,
          givenName: ProviderAttribute.FACEBOOK_FIRST_NAME,
          familyName: ProviderAttribute.FACEBOOK_LAST_NAME,
        },
      }),
    )

    this.userPoolClient.node.addDependency(
      new UserPoolIdentityProviderApple(this, 'Apple', {
        keyId: env.APPLE_APP_KEY_ID,
        teamId: env.APPLE_APP_TEAM_ID,
        clientId: env.APPLE_APP_CLIENT_ID,
        privateKey: env.APPLE_APP_AUTH_KEY,
        scopes: ['name', 'email'],
        userPool: this.userPool,
        attributeMapping: {
          email: ProviderAttribute.APPLE_EMAIL,
          givenName: ProviderAttribute.APPLE_FIRST_NAME,
          familyName: ProviderAttribute.APPLE_LAST_NAME,
          fullname: ProviderAttribute.APPLE_NAME,
        },
      }),
    )
  }

  private createUserPoolClient(userPool: UserPool) {
    const standardCognitoAttributes = {
      givenName: true,
      familyName: true,
      email: true,
      emailVerified: true,
      address: true,
      birthOfDate: true,
      gender: true,
      locale: true,
      middleName: true,
      fullName: true,
      nickname: true,
      phoneNumber: true,
      phoneNumberVerified: true,
      profilePicture: true,
      preferredUsername: true,
      profilePage: true,
      timezone: true,
      lastUpdateTime: true,
      website: true,
    }

    const clientReadAttributes = new ClientAttributes()
      .withStandardAttributes(standardCognitoAttributes)
      .withCustomAttributes(...['country', 'city', 'amplitude_id'])

    const clientWriteAttributes = new ClientAttributes()
      .withStandardAttributes({
        ...standardCognitoAttributes,
        emailVerified: false,
        phoneNumberVerified: false,
      })
      .withCustomAttributes(...['country', 'city', 'amplitude_id'])

    // 👇 User Pool Client
    const userPoolDefaultClientName = `${this.props.parentStackName}-Userpool-Client`
    const userPoolDefaultClient = new UserPoolClient(this, 'UserPoolClient', {
      userPoolClientName: userPoolDefaultClientName,
      userPool,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userSrp: true,
        userPassword: true,
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
        UserPoolClientIdentityProvider.FACEBOOK,
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.APPLE,
      ],
      oAuth: {
        callbackUrls: [env.COGNITO_APP_DEFAULT_CALLBACK_URL],
        logoutUrls: [env.COGNITO_APP_DEFAULT_LOGOUT_URL],
        scopes: [OAuthScope.EMAIL, OAuthScope.PHONE, OAuthScope.OPENID, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN],
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
      },
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
      generateSecret: true,
    })
    overrideLogicalId(userPoolDefaultClient, AWS_RESOURCE_TYPE.COGNITO.USER_POOL_CLIENT, userPoolDefaultClientName)

    // 👇 User Pool Discourse Client
    const userPoolDiscourseClientName = `${this.props.parentStackName}-Discourse-Client`
    const userPoolDiscourseClient = new UserPoolClient(this, 'DiscourseClient', {
      userPoolClientName: userPoolDiscourseClientName,
      userPool,
      authFlows: {
        adminUserPassword: false,
        custom: false,
        userSrp: false,
        userPassword: false,
      },
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        callbackUrls: [env.COGNITO_APP_DISCOURSE_CALLBACK_URL],
        logoutUrls: [env.COGNITO_APP_DISCOURSE_LOGOUT_URL],
        scopes: [OAuthScope.EMAIL, OAuthScope.PHONE, OAuthScope.OPENID, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN],
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
      },
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
      generateSecret: true,
    })
    overrideLogicalId(userPoolDiscourseClient, AWS_RESOURCE_TYPE.COGNITO.USER_POOL_CLIENT, userPoolDiscourseClientName)

    return {
      userPoolDefaultClient,
      userPoolDiscourseClient,
    }
  }

  private createCognito(removalPolicy: RemovalPolicy) {
    // Create prisma layer
    const prismaLayer = createPrismaLayer(this)
    // Create `postConfirmation` Lambda function
    const postConfirmationName = `${this.props.parentStackName}-postConfirmation`
    const postConfirmation = new NodejsFunction(
      this,
      'postConfirmation',
      getNodejsFunctionOptions(this, {
        architecture: Architecture.ARM_64,
        insightsVersion: LambdaInsightsVersion.VERSION_1_0_135_0,
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_16_X,
        functionName: postConfirmationName,
        entry: path.resolve(__dirname, '../../../functions/auth/index.ts'),
        handler: 'cognitoUserConfirmed',
        logRetention: RetentionDays.ONE_MONTH,
        environment: this.props.environment ?? {},
        layers: [prismaLayer],
        vpc: this.props.vpc,
        securityGroups: this.props.securityGroup != null ? [this.props.securityGroup] : undefined,
      }),
    )
    overrideLogicalId(postConfirmation, AWS_RESOURCE_TYPE.LAMBDA.FUNCTION, postConfirmationName)
    // Add policy
    postConfirmation.addToRolePolicy(
      createPolicyStatement(
        [
          'secretsmanager:DescribeSecret',
          'secretsmanager:GetSecretValue',
          'rds:DescribeDBProxies',
          'rds:DescribeDBProxyEndpoints',
        ],
        ['*'],
      ),
    )

    // Create `preSignUp` Lambda function
    const preSignUpName = `${this.props.parentStackName}-preSignUp`
    const preSignUp = new NodejsFunction(
      this,
      'preSignUp',
      getNodejsFunctionOptions(this, {
        architecture: Architecture.ARM_64,
        insightsVersion: LambdaInsightsVersion.VERSION_1_0_135_0,
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_16_X,
        functionName: preSignUpName,
        entry: path.resolve(__dirname, '../../../functions/auth/index.ts'),
        handler: 'cognitoPreSignUp',
        logRetention: RetentionDays.ONE_MONTH,
        environment: this.props.environment ?? {},
        layers: [prismaLayer],
      }),
    )
    overrideLogicalId(preSignUp, AWS_RESOURCE_TYPE.LAMBDA.FUNCTION, preSignUpName)
    // Add policy
    preSignUp.addToRolePolicy(
      createPolicyStatement(
        [
          'secretsmanager:DescribeSecret',
          'secretsmanager:GetSecretValue',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:ListUsers',
          'cognito-idp:AdminLinkProviderForUser',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
        ],
        ['*'],
      ),
    )

    // Create `preTokenGeneration` Lambda function
    const preTokenName = `${this.props.parentStackName}-preTokenGeneration`
    const preTokenGeneration = new NodejsFunction(
      this,
      'preTokenGeneration',
      getNodejsFunctionOptions(this, {
        architecture: Architecture.ARM_64,
        insightsVersion: LambdaInsightsVersion.VERSION_1_0_135_0,
        tracing: Tracing.ACTIVE,
        timeout: Duration.seconds(30),
        runtime: Runtime.NODEJS_16_X,
        functionName: preTokenName,
        entry: path.resolve(__dirname, '../../../functions/auth/index.ts'),
        handler: 'cognitoPreToken',
        logRetention: RetentionDays.ONE_MONTH,
        environment: this.props.environment ?? {},
        layers: [prismaLayer],
      }),
    )
    overrideLogicalId(preTokenGeneration, AWS_RESOURCE_TYPE.LAMBDA.FUNCTION, preTokenName)
    // Add policy
    preTokenGeneration.addToRolePolicy(
      createPolicyStatement(
        ['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue', 'cognito-idp:AdminUpdateUserAttributes'],
        ['*'],
      ),
    )

    // Create email customization lambda function
    const symmetricKey = Key.fromKeyArn(
      this,
      `${this.props.parentStackName}-cognitoEmailSymmetricKey`,
      this.props.environment?.KMS_KEY_ARN as string,
    )

    const customEmailSenderName = `${this.props.parentStackName}-customEmailSender`
    const customEmailSender = new NodejsFunction(
      this,
      customEmailSenderName,
      getNodejsFunctionOptions(this, {
        functionName: customEmailSenderName,
        entry: path.resolve(__dirname, '../../../functions/auth/index.ts'),
        handler: 'cognitoCustomEmailSender',
        logRetention: RetentionDays.ONE_MONTH,
        environment: merge({}, this.props.environment, {
          KMS_KEY_ARN: symmetricKey.keyArn,
          KMS_KEY_ALIAS: this.props.environment?.KMS_KEY_ALIAS as string,
          BRAZE_API_KEY: env.BRAZE_API_KEY,
          BRAZE_REST_ENDPOINT: env.BRAZE_REST_ENDPOINT,
          BRAZE_APP_ID: env.BRAZE_APP_ID,
          BRAZE_SENDER_EMAIL: env.BRAZE_SENDER_EMAIL,
        }),
        layers: [prismaLayer],
      }),
    )

    // Add policy
    symmetricKey.addToResourcePolicy(
      new PolicyStatement({
        sid: normalizeLogicalId(`${this.props.parentStackName}-customSenderKmsKeyEncryptPolicy`),
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: ['kms:Encrypt'],
        principals: [new ArnPrincipal('cognito-idp.amazonaws.com')],
      }),
    )
    symmetricKey.addToResourcePolicy(
      new PolicyStatement({
        sid: normalizeLogicalId(`${this.props.parentStackName}-customSenderKmsKeyDecryptPolicy`),
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: ['kms:Decrypt'],
        principals: [new ArnPrincipal(customEmailSender.functionArn)],
      }),
    )

    customEmailSender.addToRolePolicy(
      new PolicyStatement({
        sid: normalizeLogicalId(`${this.props.parentStackName}-customEmailSenderPolicy`),
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: ['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue', 'kms:Decrypt', 'kms:DescribeKey'],
      }),
    )

    customEmailSender.addPermission('CognitoEmailSenderInvokePermission', {
      principal: new ServicePrincipal('cognito-idp.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    })

    overrideLogicalId(customEmailSender, AWS_RESOURCE_TYPE.LAMBDA.FUNCTION, customEmailSenderName)

    this.userPoolName = `${this.props.parentStackName}-UserPool`
    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: this.userPoolName,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        country: new StringAttribute({ mutable: true }),
        city: new StringAttribute({ mutable: true }),
        amplitude_id: new StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy,
      lambdaTriggers: {
        postConfirmation,
        preSignUp,
        preTokenGeneration,
        customEmailSender,
      },
      customSenderKmsKey: symmetricKey,
      email: UserPoolEmail.withCognito(),
    })
    overrideLogicalId(this.userPool, AWS_RESOURCE_TYPE.COGNITO.USER_POOL, this.userPoolName)

    // Add Domain
    this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: env.COGNITO_DOMAIN,
      },
    })
  }
}
