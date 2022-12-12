/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import middy from '@middy/core'
import { jsonSafeParse } from '@middy/util'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import isString from 'lodash/isString'

export default (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  before: (request) => {
    const { event } = request
    event.params = {
      ...event.pathParameters,
      ...event.queryStringParameters,
      ...event.params,
      ...(isString(event.body) ? jsonSafeParse(event.body) : event.body),
    }
  },
})
