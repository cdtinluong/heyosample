import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { CreateHttpHandlerOptions, HandlerEvent } from '@layers/core/lib/http-handler'
import { sendEmail, emailTriggerSource } from 'email/services'
import { RevenueCatRequest } from './model'
import { RevenueCatService, RevenueCatEventType, CancellationReason } from './services'

export const postRevenueCat: CreateHttpHandlerOptions<RevenueCatRequest> = {
  name: 'postRevenueCat',
  withDb: true,
  isReadOnly: false,
  async handler(event: HandlerEvent<RevenueCatRequest>, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { event: revenueCatEvent } = event.params

    const service = new RevenueCatService(ctx.prisma)

    switch (revenueCatEvent.type) {
      case RevenueCatEventType.INITIAL_PURCHASE:
      case RevenueCatEventType.RENEWAL:
      case RevenueCatEventType.NON_RENEWING_PURCHASE:
      case RevenueCatEventType.PRODUCT_CHANGE:
        await Promise.all([
          sendEmail(emailTriggerSource.CustomEmailSender_OrderConfirmation, revenueCatEvent.app_user_id),
          service.handlePurchaseEvent(revenueCatEvent),
        ])
        break
      case RevenueCatEventType.CANCELLATION:
        if (revenueCatEvent.cancel_reason === CancellationReason.BILLING_ERROR) {
          await sendEmail(emailTriggerSource.CustomEmailSender_TransactionFailed, revenueCatEvent.app_user_id)
        } else if (revenueCatEvent.cancel_reason === CancellationReason.UNSUBSCRIBE) {
          await sendEmail(emailTriggerSource.CustomEmailSender_SubscriptionCancellation, revenueCatEvent.app_user_id)
        }
        await service.handleCancellationEvent(revenueCatEvent)
        break
      case RevenueCatEventType.EXPIRATION:
        await service.handleCancellationEvent(revenueCatEvent)
        break
      case RevenueCatEventType.UNCANCELLATION:
        await service.handleUncancellationEvent(revenueCatEvent)
        break
      default:
        break
    }

    return ctx.res.Ok({ message: 'Received' })
  },
}
