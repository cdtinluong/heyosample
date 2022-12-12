import env from '@ltv/env'

export interface MandatoryEnv {
  STAGE: string
  STACK_NAME: string
  RESOURCE_STACK_NAME: string
  CROSS_REGION_STACK_NAME: string
  IS_PROD: boolean
  S3_BUCKET_NAME: string
  REPLICATION_REGIONS: string[]
  MRAP_ARN: string
  MRAP_ALIAS: string
  SENTRY_DSN: string
  COGNITO_USER_POOL_ID: string
  DATABASE_URL: string
  CDK_REGION: string
  CDK_ACCOUNT: string
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  RESOURCE_REGION: string
  GOOGLE_APP_ID: string
  GOOGLE_APP_SECRET: string
  FACEBOOK_APP_ID: string
  FACEBOOK_APP_SECRET: string
  COGNITO_DOMAIN: string
  AMPLITUDE_BASE_URL: string
  AMPLITUDE_API_KEY: string
  AMPLITUDE_API_SECRET: string
  APPLE_APP_KEY_ID: string
  APPLE_APP_CLIENT_ID: string
  APPLE_APP_TEAM_ID: string
  APPLE_APP_AUTH_KEY: string
  COGNITO_APP_DISCOURSE_CALLBACK_URL: string
  COGNITO_APP_DISCOURSE_LOGOUT_URL: string
  COGNITO_APP_DEFAULT_CALLBACK_URL: string
  COGNITO_APP_DEFAULT_LOGOUT_URL: string
  HOSTED_ZONE_ID: string
  BRAZE_API_KEY: string
  BRAZE_REST_ENDPOINT: string
  BRAZE_APP_ID: string
  BRAZE_SENDER_EMAIL: string
  KMS_KEY_ARN: string
  KMS_KEY_ALIAS: string
  STACKS_OWNER: string
  REVENUE_CAT_AUTHORIZER_TOKEN_REGEX: string
}

// Default
const DEFAULT_STAGE = 'DEV'
// NOTE: on your local dev, need to change this
const DEFAULT_APP_STACK_NAME = 'LC'

// Stage
let stage: string = (env.string('STAGE', DEFAULT_STAGE) as string).toUpperCase()
if (!['DEV', 'STG', 'PRD'].includes(stage)) {
  stage = 'DEV'
}

const appStackName = `${env.string('STACK_NAME', DEFAULT_APP_STACK_NAME)}-${stage}`.toUpperCase()
// Ensure we're using proper resources and not custom one
let resource = `${appStackName}-Resource`
if (!['LC-PRD', 'LC-STG'].includes(appStackName)) {
  resource = `${DEFAULT_APP_STACK_NAME}-${DEFAULT_STAGE}-Resource`
}
const resourceStackName = resource
const crossRegionStackName = `${resourceStackName}-CrossRegion`
const bucketName = `${resourceStackName}-storage`.toLowerCase()

// Add slash at the end as per cognito requirements
const urls: string[] = [
  env.string('COGNITO_APP_DEFAULT_CALLBACK_URL', 'lincloudapp://callback/') as string,
  env.string('COGNITO_APP_DEFAULT_LOGOUT_URL', 'lincloudapp://signout/') as string,
  env.string('COGNITO_APP_DISCOURSE_CALLBACK_URL', 'lincloudapp://callback/') as string,
  env.string('COGNITO_APP_DISCOURSE_LOGOUT_URL', 'lincloudapp://signout/') as string,
]
const fixedUrls = urls.map((url: string) => {
  if (url.at(-1) !== '/') {
    return `${url}/`
  }
  return url
})

const environment: MandatoryEnv = {
  STAGE: stage,
  STACK_NAME: appStackName,
  RESOURCE_STACK_NAME: resourceStackName,
  CROSS_REGION_STACK_NAME: crossRegionStackName,
  IS_PROD: appStackName === 'LC-PRD',

  // AWS
  RESOURCE_REGION: env.string('RESOURCE_REGION', 'eu-west-1') as string,
  AWS_ACCESS_KEY_ID: env.string('AWS_ACCESS_KEY_ID', '') as string,
  AWS_SECRET_ACCESS_KEY: env.string('AWS_SECRET_ACCESS_KEY', '') as string,

  // CDK ENV
  CDK_REGION: env.string('CDK_DEFAULT_REGION', '') as string,
  CDK_ACCOUNT: env.string('CDK_DEFAULT_ACCOUNT', '') as string,
  REPLICATION_REGIONS: env.array('REPLICATION_REGIONS', []) as string[],

  // Monitoring
  SENTRY_DSN: '',

  // Database
  DATABASE_URL: env.string('DATABASE_URL') as string,

  // Storage (S3)
  S3_BUCKET_NAME: bucketName,
  MRAP_ARN: env.string('MRAP_ARN', '') as string,
  MRAP_ALIAS: env.string('MRAP_ALIAS', '') as string,

  // Google
  GOOGLE_APP_ID: env.string('GOOGLE_APP_ID', '') as string,
  GOOGLE_APP_SECRET: env.string('GOOGLE_APP_SECRET', '') as string,
  // Facebook
  FACEBOOK_APP_ID: env.string('FACEBOOK_APP_ID', '') as string,
  FACEBOOK_APP_SECRET: env.string('FACEBOOK_APP_SECRET', '') as string,
  // Apple
  APPLE_APP_KEY_ID: env.string('APPLE_APP_KEY_ID', '') as string,
  APPLE_APP_CLIENT_ID: env.string('APPLE_APP_CLIENT_ID', '') as string,
  APPLE_APP_TEAM_ID: env.string('APPLE_APP_TEAM_ID', '') as string,
  APPLE_APP_AUTH_KEY: env.string('APPLE_APP_AUTH_KEY', '') as string,

  // Cognito
  COGNITO_APP_DEFAULT_CALLBACK_URL: fixedUrls[0],
  COGNITO_APP_DEFAULT_LOGOUT_URL: fixedUrls[1],
  COGNITO_APP_DISCOURSE_CALLBACK_URL: fixedUrls[2],
  COGNITO_APP_DISCOURSE_LOGOUT_URL: fixedUrls[3],
  COGNITO_DOMAIN: env.string('COGNITO_DOMAIN', 'dev-cloud-linearity') as string,
  COGNITO_USER_POOL_ID: env.string('COGNITO_USER_POOL_ID') as string,

  // Amplitude
  AMPLITUDE_BASE_URL: env.string('AMPLITUDE_BASE_URL', '') as string,
  AMPLITUDE_API_KEY: env.string('AMPLITUDE_API_KEY', '') as string,
  AMPLITUDE_API_SECRET: env.string('AMPLITUDE_API_SECRET', '') as string,

  // DNS
  HOSTED_ZONE_ID: env.string('HOSTED_ZONE_ID', '') as string,

  // Braze
  BRAZE_API_KEY: env.string('BRAZE_API_KEY', '') as string,
  BRAZE_REST_ENDPOINT: env.string('BRAZE_REST_ENDPOINT', '') as string,
  BRAZE_APP_ID: env.string('BRAZE_APP_ID', '') as string,
  BRAZE_SENDER_EMAIL: env.string('BRAZE_SENDER_EMAIL', '') as string,
  KMS_KEY_ARN: env.string('KMS_KEY_ARN', '') as string,
  KMS_KEY_ALIAS: env.string('KMS_KEY_ALIAS', '') as string,

  // DevOps
  STACKS_OWNER: env.string('STACKS_OWNER', 'developer') as string,

  // RevenueCat
  REVENUE_CAT_AUTHORIZER_TOKEN_REGEX: env.string('REVENUE_CAT_AUTHORIZER_TOKEN_REGEX', '') as string,
}

export default environment
