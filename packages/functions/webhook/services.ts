import { PrismaService } from '@layers/prisma/prisma.svc'
import { PlanType, Prisma } from '@layers/prisma'
import { Event } from './model'

export enum RevenueCatEventType {
  INITIAL_PURCHASE = 'INITIAL_PURCHASE',
  NON_RENEWING_PURCHASE = 'NON_RENEWING_PURCHASE',
  RENEWAL = 'RENEWAL',
  PRODUCT_CHANGE = 'PRODUCT_CHANGE',
  CANCELLATION = 'CANCELLATION',
  EXPIRATION = 'EXPIRATION',
  UNCANCELLATION = 'UNCANCELLATION',
}

export enum CancellationReason {
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  BILLING_ERROR = 'BILLING_ERROR',
}

export class RevenueCatService extends PrismaService {
  public async handlePurchaseEvent(event: Event): Promise<void> {
    const planProducts = await this.client.planProduct.findMany({
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

    const planProduct = planProducts.find((p) =>
      event.type === RevenueCatEventType.PRODUCT_CHANGE
        ? p.externalId === event.new_product_id
        : p.externalId === event.product_id,
    )

    if (event.type !== RevenueCatEventType.INITIAL_PURCHASE) {
      await this.client.userPlan.updateMany({
        where: {
          userId: event.app_user_id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
    }
    await this.client.userPlan.create({
      data: {
        planProductId: planProduct?.id as string,
        userId: event.app_user_id,
        transactionId: event.transaction_id,
        planId: planProduct?.planId as string,
        isActive: true,
        type: event.type === RevenueCatEventType.NON_RENEWING_PURCHASE ? PlanType.NON_RENEWING : PlanType.AUTO_RENEWAL,
        expireAt: new Date(Number(event.expiration_at_ms)),
        details: event as unknown as Prisma.InputJsonObject,
      },
    })
  }

  public async handleCancellationEvent(event: Event): Promise<void> {
    await this.client.userPlan.updateMany({
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
  }

  public async handleUncancellationEvent(event: Event) {
    const userPlan = await this.client.userPlan.findFirst({
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

    await this.client.userPlan.update({
      where: {
        id: userPlan?.id,
      },
      data: {
        isActive: true,
      },
    })
  }
}
