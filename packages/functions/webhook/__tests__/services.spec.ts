import { faker } from '@faker-js/faker'
import { PlanType } from '@layers/prisma'
import { RevenueCatService, RevenueCatEventType } from '../services'
import { Event } from '../model'


const planProductFindManyMock = jest.fn()
const userPlanUpdateManyMock = jest.fn()
const userPlanCreateMock = jest.fn()
const userPlanUpdateMock = jest.fn()
const userPlainFindFirstMock = jest.fn()

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  $transaction: jest.fn(() => Promise.resolve()),
  planProduct: {
    findMany: planProductFindManyMock,
  },
  userPlan: {
    findFirst: userPlainFindFirstMock,
    update: userPlanUpdateMock,
    updateMany: userPlanUpdateManyMock,
    create: userPlanCreateMock,
  },
}

const event: Partial<Event> = {
  type: RevenueCatEventType.INITIAL_PURCHASE,
  transaction_id: faker.datatype.uuid(),
  app_user_id: faker.datatype.uuid(),
  product_id: 'rc_0000_1m_free',
  new_product_id: 'rc_0000_1m_teams',
  expiration_at_ms : 1601311606660,
}

describe('RevenueCatService', () => {
  beforeEach(() => {
    planProductFindManyMock.mockReset()
    userPlanUpdateManyMock.mockReset()
    userPlanCreateMock.mockReset(),
    userPlainFindFirstMock.mockReset(),
    userPlanUpdateMock.mockReset()
  })

  const revenueCatService = new RevenueCatService(prismaClient)

  describe('handlePurchaseEvent', () => {
    const planProducts = [
      {
        externalId: event.product_id,
        planId: faker.datatype.uuid(),
        id: faker.datatype.uuid(),
      },
      {
        externalId: event.new_product_id,
        planId: faker.datatype.uuid(),
        id: faker.datatype.uuid(),
      }
    ]

    it('should handle init purchase event successfully', async () => {
      planProductFindManyMock.mockResolvedValue(planProducts)

      await revenueCatService.handlePurchaseEvent(event as Event)

      expect(planProductFindManyMock).toBeCalledWith({
        where: {
          OR: [
            {
              externalId: event.product_id,
            },
            {
              externalId: event.new_product_id,
            },
          ],
        },
        select: {
          id: true,
          planId: true,
          externalId: true,
        },
      })
      expect(userPlanUpdateManyMock).not.toBeCalled()
      expect(userPlanCreateMock).toHaveBeenCalledWith({
        data: {
          planProductId: planProducts[0].id,
          userId: event.app_user_id,
          transactionId: event.transaction_id,
          planId: planProducts[0].planId,
          isActive: true,
          type: PlanType.AUTO_RENEWAL,
          expireAt: new Date(Number(event.expiration_at_ms)),
          details: event,
        }
      })
    })

    it('should handle change product event successfully', async () => {
      planProductFindManyMock.mockResolvedValue(planProducts)

      await revenueCatService.handlePurchaseEvent({
        ...event,
        type: RevenueCatEventType.PRODUCT_CHANGE
      } as Event)

      expect(planProductFindManyMock).toBeCalledWith({
        where: {
          OR: [
            {
              externalId: event.product_id,
            },
            {
              externalId: event.new_product_id,
            },
          ],
        },
        select: {
          id: true,
          planId: true,
          externalId: true,
        },
      })
      expect(userPlanUpdateManyMock).toBeCalledWith({
        where: {
          userId: event.app_user_id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
      expect(userPlanCreateMock).toHaveBeenCalledWith({
        data: {
          planProductId: planProducts[1].id,
          userId: event.app_user_id,
          transactionId: event.transaction_id,
          planId: planProducts[1].planId,
          isActive: true,
          type: PlanType.AUTO_RENEWAL,
          expireAt: new Date(Number(event.expiration_at_ms)),
          details: { ...event, type: RevenueCatEventType.PRODUCT_CHANGE },
        }
      })
    })
    
    it('should handle non renewing event successfully', async () => {
      planProductFindManyMock.mockResolvedValue(planProducts)

      await revenueCatService.handlePurchaseEvent({
        ...event,
        type: RevenueCatEventType.NON_RENEWING_PURCHASE
      } as Event)

      expect(planProductFindManyMock).toBeCalledWith({
        where: {
          OR: [
            {
              externalId: event.product_id,
            },
            {
              externalId: event.new_product_id,
            },
          ],
        },
        select: {
          id: true,
          planId: true,
          externalId: true,
        },
      })
      expect(userPlanUpdateManyMock).toBeCalledWith({
        where: {
          userId: event.app_user_id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
      expect(userPlanCreateMock).toHaveBeenCalledWith({
        data: {
          planProductId: planProducts[0].id,
          userId: event.app_user_id,
          transactionId: event.transaction_id,
          planId: planProducts[0].planId,
          isActive: true,
          type: PlanType.NON_RENEWING,
          expireAt: new Date(Number(event.expiration_at_ms)),
          details: { ...event, type: RevenueCatEventType.NON_RENEWING_PURCHASE },
        }
      })
    })
  })

  describe('handleCancellationEvent', () => {
    it('should handle cancellation event successfully', async () => {
      await revenueCatService.handleCancellationEvent({
        ...event,
        type: RevenueCatEventType.CANCELLATION
      } as Event)

      expect(userPlanUpdateManyMock).toHaveBeenCalledWith({
        where: {
          userId: event.app_user_id,
          isActive: true,
          planProduct: {
            externalId: event.product_id,
          },
        },
        data: {
          isActive: false,
        },
      })
    })
  })
  
  describe('handleUncancellationEvent', () => {
    it('should handle Uncancellation event successfully', async () => {
      const userPlanId = faker.datatype.uuid()
      userPlainFindFirstMock.mockResolvedValue({ id: userPlanId })

      await revenueCatService.handleUncancellationEvent({
        ...event,
        type: RevenueCatEventType.UNCANCELLATION
      } as Event)

      expect(userPlainFindFirstMock).toBeCalledWith({
        where: {
          userId: event.app_user_id,
          planProduct: {
            externalId: event.product_id,
          },
        },
        select: {
          id: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      expect(userPlanUpdateMock).toBeCalledWith({
        where: {
          id: userPlanId,
        },
        data: {
          isActive: true,
        },
      })
    })
  })
})