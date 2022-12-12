import { PrismaClient } from '@prisma/client'
import { SecretsManager, RDS } from 'aws-sdk'
import env from 'cdk/lib/env'

export * from '@prisma/client'

interface DBSecret {
  username: string
  password: string
  host: string
  port: number
  dbname: string
}

let prisma: PrismaClient

/**
 * get db proxy endpoint based on endpoint type
 *
 * @param isReadOnly
 * @returns
 */
async function getDbEndpoint(isReadOnly: boolean) {
  const rds = new RDS({
    region: env.RESOURCE_REGION,
  })
  if (isReadOnly) {
    console.log('Using readonly endpoint')
    // get the endpoint
    const desProxyEndpointsResult = await rds
      .describeDBProxyEndpoints({
        DBProxyEndpointName: `${env.RESOURCE_STACK_NAME}-DBProxy-RO-endpoint`.toLowerCase(),
        DBProxyName: `${env.RESOURCE_STACK_NAME}-DBProxy`.toLowerCase(),
      })
      .promise()
    const endpoint = desProxyEndpointsResult.DBProxyEndpoints?.find(
      (proxyEndpoint) => proxyEndpoint.TargetRole === 'READ_ONLY',
    )
    if (endpoint == null) throw new Error('Got nullish endpoint for readonly')

    return endpoint.Endpoint as string
  }

  const dbProxy = await rds.describeDBProxies({ DBProxyName: `${env.RESOURCE_STACK_NAME}-DBProxy` }).promise()
  if (dbProxy === undefined || dbProxy.DBProxies === undefined || dbProxy.DBProxies.length === 0) {
    throw new Error('Unable to retrieve DBProxy endpoint')
  }

  return dbProxy.DBProxies[0].Endpoint as string
}

/**
 * create prisma endpoint
 *
 * @param isReadOnly only select the read only endpoint
 * @returns
 */
export async function createPrismaCLient(isReadOnly: boolean) {
  if (prisma === undefined || prisma === null) {
    console.log('=> Using new database connection')
    const secretsManager = new SecretsManager({
      region: env.RESOURCE_REGION,
    })
    // Setup the DB URL
    const secretValue = await secretsManager
      .getSecretValue({
        SecretId: `${env.RESOURCE_STACK_NAME}-db-cluster`,
      })
      .promise()
    if (secretValue === undefined || secretValue.SecretString === undefined) {
      throw new Error('Unable to retrieve Secret')
    }
    const { username, password, port, dbname } = JSON.parse(secretValue.SecretString ?? '') as DBSecret
    const dbEndpoint = await getDbEndpoint(isReadOnly)
    const databaseUrl = `postgresql://${username}:${password}@${dbEndpoint}:${port}/${dbname}?schema=public&connection_limit=1&connect_timeout=300`

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })

    await prisma.$connect()
  }

  return prisma
}
