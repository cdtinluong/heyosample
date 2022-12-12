/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, no-param-reassign */
import middy from '@middy/core'
import { APIGatewayProxyCognitoAuthorizer, APIGatewayProxyEventBase, APIGatewayProxyResult } from 'aws-lambda'
import isEmpty from 'lodash/isEmpty'

type APIGatewayProxyEventWithAuthorizer = APIGatewayProxyEventBase<APIGatewayProxyCognitoAuthorizer> & {
  meta: ProxyEventMetaData
}

export default (): middy.MiddlewareObj<APIGatewayProxyEventWithAuthorizer, APIGatewayProxyResult> => ({
  before({ event }) {
    if (event === undefined) {
      return
    }
    const token = event.headers.Authorization
    const { authorizer } = event.requestContext
    if (isEmpty(authorizer) || isEmpty(token)) {
      return
    }

    event.meta = {
      token: token as string,
      user: {
        id: authorizer.claims.sub,
        email: authorizer.claims.email,
        given_name: authorizer.claims.given_name,
        family_name: authorizer.claims.family_name,
      },
      deviceId: event.headers['x-device-id'] ?? '',
    }
  },
})
