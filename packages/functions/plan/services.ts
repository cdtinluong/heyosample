import { Prisma, Store } from '@layers/prisma'
import { PrismaService } from '@layers/prisma/prisma.svc'
import { validate as uuidValidate } from 'uuid'
import { PlanFindMany, PlanSelect } from './models'

export class PlanService extends PrismaService {
  /**
   * Get all active plans
   *
   * @param store value, can be APP_STORE or STRIPE
   * @returns array of plans
   */
  public async getPlans(store: Store): Promise<PlanSelect[]> {
    return this.fetchPlans(store)
  }

  /**
   * Get a spcific active plan based on its ID or external ID
   *
   * @param planOrExternalId plan or External ID
   * @param store value, can be APP_STORE or STRIPE
   * @returns array of plans
   */
  public async getPlan(planOrExternalId: string, store: Store): Promise<PlanSelect | null> {
    const plans = await this.fetchPlans(store, planOrExternalId)

    return plans[0]
  }

  /**
   * Private method used by getPlans and getPlan
   *
   * @param store value, can be APP_STORE or STRIPE
   * @param id plan or External ID
   * @returns array of plans
   */
  private async fetchPlans(store: Store, id?: string): Promise<PlanSelect[]> {
    const condition: Prisma.PlanWhereInput = {
      isActive: true,
      products: {
        some: {
          store,
        },
      },
    }
    // Filter if we've got an idea
    if (id !== null && id !== undefined) {
      if (uuidValidate(id) === true) {
        condition.id = id
      } else {
        condition.products = {
          some: {
            externalId: id,
          },
        }
      }
    }

    const plans = await this.client.plan.findMany({
      where: condition,
      orderBy: [
        {
          updatedAt: 'desc',
        },
      ],
      select: {
        id: true,
        options: true,
        description: true,
        advantages: true,
        advantagesDescription: true,
        isActive: true,
        products: {
          select: {
            externalId: true,
          },
        },
      },
    })

    return plans.map((plan: PlanFindMany) => ({
      id: plan.id,
      options: plan.options,
      description: plan.description,
      advantages: plan.advantages,
      advantagesDescription: plan.advantagesDescription,
      isActive: plan.isActive,
      externalId: plan.products[0].externalId,
    }))
  }
}
