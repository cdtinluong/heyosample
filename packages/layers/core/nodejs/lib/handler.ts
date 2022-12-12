/* eslint-disable no-unused-vars */
import middy from '@middy/core'
import secretsManager from '@middy/secrets-manager'
import warmup from '@middy/warmup'
import type { Context } from 'aws-lambda'
import env from 'cdk/lib/env'
import isEmpty from 'lodash/isEmpty'
import merge from 'lodash/merge'
import normalizeContext from './middleware/normalize-context'
import prisma from './middleware/prisma'

export type AsyncHandler<TEvent, TResult> = (event: TEvent, context: Context) => Promise<TResult>

export interface CreateHandlerOptions<P = unknown, R = unknown> {
  name: string
  params?: P
  secretsData?: { [key: string]: string } // { key: context property to set secret value, value: is name of the secret }
  withDb?: boolean
  isReadOnly?: boolean
  middlewares?: Array<middy.MiddlewareObj<P, R>>
  handler: AsyncHandler<P, R>
}

/**
 *
 * @param opts: CreateHandlerOptions
 * @returns
 */
export const createHandler = <P = unknown, R = unknown>(opts: CreateHandlerOptions<P, R>) => {
  const options = merge({ withDb: true, isReadOnly: false }, opts)
  let secretsData: { [key: string]: string } = {}

  const mHandler = middy<P, R>().use(warmup()).use(normalizeContext())
  if (options.withDb && !env.DATABASE_URL) {
    // Setting to Fetch DB connection from secretsManager
    secretsData.databaseConfig = `${env.RESOURCE_STACK_NAME}-db-cluster`
  }

  if (!isEmpty(secretsData) || options.secretsData) {
    // Fetch secret value from secretsManager then set it to context
    secretsData = merge(secretsData, options.secretsData)
    mHandler.use(
      secretsManager({
        fetchData: secretsData,
        setToContext: true,
        awsClientOptions: {
          region: env.RESOURCE_REGION,
        },
      }),
    )
  }

  if (options.withDb) {
    // define the postgresql connection
    mHandler.use(prisma({ isReadOnly: options.isReadOnly }))
  }

  if (options.middlewares && options.middlewares.length > 0) {
    options.middlewares.forEach((middleware) => mHandler.use(middleware))
  }

  mHandler.schema = options
  return mHandler.handler(options.handler)
}
