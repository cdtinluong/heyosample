/* eslint-disable no-undef */
import '@middy/core'
import 'aws-lambda'
import { PrismaClient } from 'packages/layers/prisma/nodejs'

declare module 'aws-lambda' {
  export interface Context {
    res: IResponse<APIGatewayProxyResult>
    prisma: PrismaClient
  }
}

declare module '@middy/core' {
  import type { MiddyInputHandler, MiddyInputPromiseHandler } from '@middy/core'
  import type { Context as LambdaContext } from 'aws-lambda'
  export interface MiddyfiedHandler<
    TEvent = any,
    TResult = any,
    TErr = Error,
    TContext extends LambdaContext = LambdaContext,
  > extends MiddyInputHandler<TEvent, TResult, TContext>,
      MiddyInputPromiseHandler<TEvent, TResult, TContext> {
    schema: any
  }
}
