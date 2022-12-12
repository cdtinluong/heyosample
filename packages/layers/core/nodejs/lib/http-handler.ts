/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { PrismaClient } from '@layers/prisma'
import middy from '@middy/core'
import httpErrorHandler from '@middy/http-error-handler'
import jsonBodyParser from '@middy/http-json-body-parser'
import secretsManager from '@middy/secrets-manager'
import warmup from '@middy/warmup'
import cors from '@middy/http-cors'
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context as LambdaContext } from 'aws-lambda'
import env from 'cdk/lib/env'
import isEmpty from 'lodash/isEmpty'
import merge from 'lodash/merge'
import httpEventNormalizer from './middleware/http-event-normalizer'
import meta from './middleware/meta'
import normalizeContext from './middleware/normalize-context'
import normalizeEventParams from './middleware/normalize-event-params'
import prisma from './middleware/prisma'
import respSerializerMiddleware from './middleware/response-serializer'

interface HandlerEventWithParams<P> {
  params: P
}
export type HandlerEvent<P = unknown> = APIGatewayProxyEventV2 & HandlerEventWithParams<P>
type HandlerEventWithMetadata<P = unknown> = HandlerEvent<P> & { meta: ProxyEventMetaData }
type Middlewares = middy.MiddlewareObj<APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2>

export interface HandlerContext extends LambdaContext {
  res: IResponse<APIGatewayProxyStructuredResultV2>
  prisma: PrismaClient
}

export interface CreateHttpHandlerOptions<EventTypeOrParamType = unknown> {
  name?: string
  method?: string
  params?: EventTypeOrParamType extends HandlerEvent ? EventTypeOrParamType['params'] : EventTypeOrParamType
  secretsData?: { [key: string]: string } // { key: context property to set secret value, value: is name of the secret }
  withDb?: boolean
  isReadOnly?: boolean
  middlewares?: Middlewares[]
  handler: (event: any, context: HandlerContext) => Promise<APIGatewayProxyStructuredResultV2>
}

export interface CreateHttpHandlerWithoutAuthOptions<EventTypeOrParamType = unknown>
  extends CreateHttpHandlerOptions<EventTypeOrParamType> {
  handler: (
    event: EventTypeOrParamType extends HandlerEvent ? EventTypeOrParamType : HandlerEvent<EventTypeOrParamType>,
    context: HandlerContext,
  ) => Promise<APIGatewayProxyStructuredResultV2>
}

export interface CreateHttpHandlerWithAuthOptions<EventTypeOrParamType = unknown>
  extends CreateHttpHandlerOptions<EventTypeOrParamType> {
  handler: (
    event: EventTypeOrParamType extends HandlerEventWithMetadata
      ? EventTypeOrParamType
      : HandlerEventWithMetadata<EventTypeOrParamType>,
    context: HandlerContext,
  ) => Promise<APIGatewayProxyStructuredResultV2>
}

/**
 *
 * @param opts: CreateHttpHandlerOptions
 * @returns
 */
export const createHttpHandler = <O extends CreateHttpHandlerOptions>(opts: O) => {
  const options = merge({ withDb: true, isReadOnly: false }, opts)
  let secretsData: { [key: string]: string } = {}

  const mHandler = middy()
    .use(warmup())
    .use(normalizeContext())
    .use(httpEventNormalizer())
    .use(jsonBodyParser())
    .use(normalizeEventParams())
    .use(meta())
    .use(respSerializerMiddleware())

  if (options.withDb && isEmpty(process.env.DATABASE_URL)) {
    // Setting to Fetch DB connection from secretsManager
    secretsData.databaseConfig = `${env.RESOURCE_STACK_NAME}-db-cluster`
  }

  if (!isEmpty(secretsData) || options.secretsData) {
    // Fetch secret value from secretsManager then set it to context
    secretsData = merge(secretsData, options.secretsData)
    mHandler.use(
      secretsManager({
        fetchData: secretsData,
        awsClientOptions: {
          region: env.RESOURCE_REGION,
        },
        setToContext: true,
      }),
    )
  }

  if (options.withDb) {
    // define the postgresql connection
    mHandler.use(prisma({ isReadOnly: options.isReadOnly }))
  }

  // check and use cors
  if (process.env.CORS != null) {
    const corsOption = JSON.parse(process.env.CORS)
    // add cors
    mHandler.use(cors(corsOption))
  }

  if (options.middlewares && options.middlewares.length > 0) {
    options.middlewares.forEach((middleware) => mHandler.use(middleware))
  }

  mHandler.schema = options

  return mHandler.use(httpErrorHandler()).handler(options.handler)
}
