/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const defaults = {
  payloadFormatVersion: 1,
}

const isHttpEvent = (payloadFormatVersion: number, event: APIGatewayProxyEvent) => {
  if (payloadFormatVersion === 1) {
    return Object.prototype.hasOwnProperty.call(event, 'httpMethod')
  }

  if (payloadFormatVersion === 2) {
    return (
      Object.prototype.hasOwnProperty.call(event, 'requestContext') &&
      Object.prototype.hasOwnProperty.call(event.requestContext, 'http') &&
      Object.prototype.hasOwnProperty.call((event.requestContext as any).http, 'method')
    )
  }
  throw new Error('Unknown API Gateway Payload format. Please use value 1 or 2.')
}

export default (opts = {}): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const options = { ...defaults, ...opts }

  const httpEventNormalizerMiddlewareBefore: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = (
    request,
  ) => {
    const { event } = request
    if (event.body === null || event.body === undefined) {
      event.body = '{}'
    }
    if (isHttpEvent(options.payloadFormatVersion, event)) {
      event.queryStringParameters = event.queryStringParameters ?? {}
      event.pathParameters = event.pathParameters ?? {}
      if (options.payloadFormatVersion === 1) {
        event.multiValueQueryStringParameters = event.multiValueQueryStringParameters ?? {}
      }
    }
  }

  return {
    before: httpEventNormalizerMiddlewareBefore,
  }
}
