import { Pool } from 'pg'
import env from '@ltv/env'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { RDS } from '@aws-sdk/client-rds'

let pool: Pool

const secretsClient = new SecretsManagerClient({ region: env.string('RESOURCE_REGION', '') })
const params = {
  SecretId: env.string('SECRET_ID', ''),
}
let databaseUrl = ''
interface DatabaseFromSecretConfiguration {
  host: string
  dbname: string
  password: string
  username: string
  port: string | number
}

export async function createClient() {
  const data = await secretsClient.send(new GetSecretValueCommand(params))
  const rds = new RDS({ region: env.string('RESOURCE_REGION', '') })
  const dbProxy = await rds.describeDBProxies({ DBProxyName: env.string('DB_PROXY_NAME', '') })
  if (
    data.SecretString !== null &&
    data.SecretString !== undefined &&
    dbProxy.DBProxies !== undefined &&
    dbProxy.DBProxies.length !== 0
  ) {
    const host = dbProxy.DBProxies[0].Endpoint
    const { username, password, port, dbname } = JSON.parse(data.SecretString) as DatabaseFromSecretConfiguration
    databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${dbname}?schema=public&connection_limit=1&connect_timeout=300`
  }
  if (pool === null || pool === undefined) {
    pool = new Pool({
      connectionString: databaseUrl,
    })
  }

  return pool
}

export async function closeConnection() {
  await pool.end()
}
