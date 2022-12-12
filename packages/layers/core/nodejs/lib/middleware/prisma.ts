import { createPrismaCLient } from '@layers/prisma'
import middy from '@middy/core'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

export default ({
  isReadOnly,
}: {
  isReadOnly: boolean
}): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => ({
  async before(request) {
    request.context.prisma = await createPrismaCLient(isReadOnly === true)
  },
})
