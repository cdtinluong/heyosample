import env from 'cdk/lib/env'
import { CognitoIdentityServiceProvider, S3Control, SecretsManager, RDS } from 'aws-sdk'

interface DBSecret {
  username: string
  password: string
  host: string
  port: number
  dbname: string
}

const cognitoISP = new CognitoIdentityServiceProvider({
  region: env.RESOURCE_REGION,
})
const s3Control = new S3Control({ region: 'us-west-2' })
const secretsManager = new SecretsManager({
  region: env.RESOURCE_REGION,
})
const rds = new RDS({
  region: env.RESOURCE_REGION,
})

export async function run() {
  // Setup the Multi Region Access Point
  const accountId = process.env.ACCOUNT_ID ?? '522227034001'
  const mrap = await s3Control
    .getMultiRegionAccessPoint({
      Name: `${env.RESOURCE_STACK_NAME}-multiregionaccesspoint`.toLowerCase(),
      AccountId: accountId,
    })
    .promise()
  if (mrap === undefined || mrap.AccessPoint === undefined) {
    throw new Error('Unable to retrieve MRAP')
  }

  // Setup the Cognito User Pool ID by using the User Pool Domain
  const userPoolDomain = await cognitoISP.describeUserPoolDomain({ Domain: env.COGNITO_DOMAIN }).promise()
  if (userPoolDomain === undefined || userPoolDomain.DomainDescription === undefined) {
    throw new Error('Unable to retrieve User Pool ID')
  }

  // Setup the DB URL
  const secretValue = await secretsManager
    .getSecretValue({
      SecretId: `${env.RESOURCE_STACK_NAME}-db-cluster`,
    })
    .promise()
  if (secretValue === undefined || secretValue.SecretString === undefined) {
    throw new Error('Unable to retrieve Secret')
  }
  const secretObj = JSON.parse(secretValue.SecretString ?? '') as DBSecret
  const dbProxy = await rds.describeDBProxies({ DBProxyName: `${env.RESOURCE_STACK_NAME}-DBProxy` }).promise()

  if (dbProxy === undefined || dbProxy.DBProxies === undefined || dbProxy.DBProxies.length === 0) {
    throw new Error('Unable to retrieve DBProxy endpoint')
  }

  // This script will be executed with `eval` in the pipeline
  console.info(`export COGNITO_USER_POOL_ID="${userPoolDomain.DomainDescription.UserPoolId}"`)
  console.info(`export MRAP_ARN="arn:aws:s3::${accountId}:accesspoint/${mrap.AccessPoint.Alias}"`)
  console.info(
    `export DATABASE_URL="postgresql://${secretObj.username}:${secretObj.password}@${dbProxy.DBProxies[0].Endpoint}:${secretObj.port}/${secretObj.dbname}?connect_timeout=300&connection_limit=1"`,
  )
}
