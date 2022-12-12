import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { CreateHttpHandlerWithAuthOptions } from '@layers/core/lib/http-handler'
import { CustomCode } from '@layers/core/lib/code'
import { Store } from '@layers/prisma'
import { PlanService } from './services'

export const getPlanList: CreateHttpHandlerWithAuthOptions<{
  store: Store
}> = {
  name: 'getPlanList',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const planService = new PlanService(ctx.prisma)
    const plans = await planService.getPlans(event.params.store)

    return ctx.res.Ok({ message: 'Plans retrieved', code: CustomCode.PLANS_RETRIEVED, data: plans })
  },
}

export const getPlan: CreateHttpHandlerWithAuthOptions<{
  store: Store
  planOrExternalId: string
}> = {
  name: 'getPlan',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const planService = new PlanService(ctx.prisma)
    const plan = await planService.getPlan(event.params.planOrExternalId, event.params.store)
    if (!plan) {
      return ctx.res.NotFound(JSON.stringify({ message: 'Plan not found', code: CustomCode.PLAN_NOT_FOUND }))
    }

    return ctx.res.Ok({ message: 'Plan retrieved', code: CustomCode.PLAN_RETRIEVED, data: plan })
  },
}
