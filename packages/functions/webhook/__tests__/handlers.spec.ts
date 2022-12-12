import { faker } from '@faker-js/faker'
import { Response } from '@layers/core/lib/response'
import * as emailService from '../../email/services'
import { RevenueCatService, RevenueCatEventType, CancellationReason } from '../services'
import { RevenueCatRequest } from '../model'


const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
}
const ctx: any = { res: new Response(), prisma: prismaClient }

const revenueCatService = Object.getPrototypeOf(new RevenueCatService(prismaClient))
const handlePurchaseEventMock = jest.spyOn(revenueCatService, 'handlePurchaseEvent')
const handleCancellationEventMock = jest.spyOn(revenueCatService, 'handleCancellationEvent')
const handleUncancellationEventMock = jest.spyOn(revenueCatService, 'handleUncancellationEvent')


const sendEmailMock = jest.spyOn(emailService, 'sendEmail')

const userId = faker.datatype.uuid()
const request: Partial<RevenueCatRequest> = {
  api_version: '1.0',
}

describe('webhook', () => {
  beforeEach(() => {
    sendEmailMock.mockReset()
    handlePurchaseEventMock.mockReset()
    handleCancellationEventMock.mockReset()
    handleUncancellationEventMock.mockReset()
  })

  describe('postRevenueCat', () => {
    it('should process event INITIAL_PURCHASE successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.INITIAL_PURCHASE }
          }
        },
      ctx)

      expect(sendEmailMock).toHaveBeenCalledWith(emailService.emailTriggerSource.CustomEmailSender_OrderConfirmation, userId)
      expect(handlePurchaseEventMock).toHaveBeenCalledWith({ app_user_id: userId, type: RevenueCatEventType.INITIAL_PURCHASE })
    })

    it('should process event RENEWAL successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.RENEWAL }
          }
        },
      ctx)

      expect(sendEmailMock).toHaveBeenCalledWith(emailService.emailTriggerSource.CustomEmailSender_OrderConfirmation, userId)
      expect(handlePurchaseEventMock).toHaveBeenCalledWith({ app_user_id: userId, type: RevenueCatEventType.RENEWAL })
    })

    it('should process event NON_RENEWING_PURCHASE successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.NON_RENEWING_PURCHASE }
          }
        },
      ctx)

      expect(sendEmailMock).toHaveBeenCalledWith(emailService.emailTriggerSource.CustomEmailSender_OrderConfirmation, userId)
      expect(handlePurchaseEventMock).toHaveBeenCalledWith({ app_user_id: userId, type: RevenueCatEventType.NON_RENEWING_PURCHASE })
    })

    it('should process event PRODUCT_CHANGE successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.PRODUCT_CHANGE }
          }
        },
      ctx)

      expect(sendEmailMock).toHaveBeenCalledWith(emailService.emailTriggerSource.CustomEmailSender_OrderConfirmation, userId)
      expect(handlePurchaseEventMock).toHaveBeenCalledWith({ app_user_id: userId, type: RevenueCatEventType.PRODUCT_CHANGE })
    })

    it('should process event CANCELLATION with reason BILLING_ERROR successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.CANCELLATION, cancel_reason: CancellationReason.BILLING_ERROR }
          }
        },
      ctx)

      expect(sendEmailMock).toHaveBeenCalledWith(emailService.emailTriggerSource.CustomEmailSender_TransactionFailed, userId)
      expect(handleCancellationEventMock).toHaveBeenCalledWith({
        app_user_id: userId, 
        type: RevenueCatEventType.CANCELLATION, 
        cancel_reason: CancellationReason.BILLING_ERROR 
      })
    })

    it('should process event CANCELLATION with reason UNSUBSCRIBE successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.CANCELLATION, cancel_reason: CancellationReason.UNSUBSCRIBE }
          }
        },
      ctx)

      expect(sendEmailMock).toHaveBeenCalledWith(emailService.emailTriggerSource.CustomEmailSender_SubscriptionCancellation, userId)
      expect(handleCancellationEventMock).toHaveBeenCalledWith({ 
        app_user_id: userId, 
        type: RevenueCatEventType.CANCELLATION, 
        cancel_reason: CancellationReason.UNSUBSCRIBE 
      })
    })

    it('should process event EXPIRATION successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.EXPIRATION }
          }
        },
      ctx)

      expect(sendEmailMock).not.toBeCalled()
      expect(handleCancellationEventMock).toHaveBeenCalledWith({ 
        app_user_id: userId, 
        type: RevenueCatEventType.EXPIRATION,
      })
    })

    it('should process event UNCANCELLATION successfully', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: RevenueCatEventType.UNCANCELLATION }
          }
        },
      ctx)

      expect(sendEmailMock).not.toBeCalled()
      expect(handleUncancellationEventMock).toHaveBeenCalledWith({ 
        app_user_id: userId, 
        type: RevenueCatEventType.UNCANCELLATION,
      })
    })

    it('should not process event other events', async () => {
      const { postRevenueCat } = await import('../handlers')
      await postRevenueCat.handler(
        { 
          params: {
            ...request, 
            event: { app_user_id: userId, type: 'TRANSFER'}
          }
        },
      ctx)

      expect(sendEmailMock).not.toBeCalled()
      expect(handleUncancellationEventMock).not.toBeCalled()
      expect(handlePurchaseEventMock).not.toBeCalled()
      expect(handleCancellationEventMock).not.toBeCalled()
    })
  })
})