import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { Response } from '../response'

export default (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  before({ context }) {
    context.res = new Response()
  },
})
