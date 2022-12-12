import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { CreateHttpHandlerWithAuthOptions } from '@layers/core/lib/http-handler'

import { CustomCode } from '@layers/core/lib/code'
import { PollingService } from './services'
import { isIsoDate } from './utils'

export const getPolling: CreateHttpHandlerWithAuthOptions<{ lastUpdated: string; token?: string }> = {
  name: 'getPolling',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id: userId } = event.meta.user
    const { lastUpdated, token } = event.params
    const pollingService = new PollingService(ctx.prisma)
    if (!isIsoDate(lastUpdated))
      return ctx.res.BadRequest(
        JSON.stringify({
          message: `Invalid lastUpdated iso UTC date, got: ${lastUpdated}`,
          code: CustomCode.POLLING_FAILED,
        }),
      )

    const data = await pollingService.getPolling(userId, new Date(lastUpdated), token)
    return ctx.res.Ok({ data, message: 'Polling retrieved', code: CustomCode.POLLING_SUCCESS })
  },
}
