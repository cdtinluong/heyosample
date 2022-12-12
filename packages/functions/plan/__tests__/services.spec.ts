import { faker } from '@faker-js/faker'
import { PlanService } from '../services'

const findMany = jest.fn()

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  plan: {
    findMany,
  },
}

describe('plan/services.ts', () => {
  const planService = new PlanService(prismaClient)
  const planId = faker.datatype.uuid()
  const externalId = faker.datatype.string()
  const store = 'APP_STORE'
  const planSelect = {
    id: planId,
    products: [{ externalId }],
    options: { fileNb: 5 },
    description: 'Desc',
    advantages: ['Advantages 1'],
    advantagesDescription: 'Advantages Desc',
    isActive: true,
  }
  const planResult = {
    id: planId,
    externalId,
    options: { fileNb: 5 },
    description: 'Desc',
    advantages: ['Advantages 1'],
    advantagesDescription: 'Advantages Desc',
    isActive: true,
  }

  describe('GET /plan/list', () => {
    it('Returns plans', async () => {
      findMany.mockReturnValue(Promise.resolve([planSelect]))
      return planService.getPlans(store).then((result) => {
        expect(result).toEqual([planResult])
      })
    })
  })

  describe('GET /plan/{planOrExternalId}', () => {
    it('Returns a plan with planId', async () => {
      findMany.mockReturnValue(Promise.resolve([planSelect]))
      return planService.getPlan(planId, store).then((result) => {
        expect(result).toEqual(planResult)
      })
    })

    it('Returns a plan with externalId', async () => {
      findMany.mockReturnValue(Promise.resolve([planSelect]))
      return planService.getPlan(externalId, store).then((result) => {
        expect(result).toEqual(planResult)
      })
    })

    it('Throws an error if the plan or external id does not exist', async () => {
      findMany.mockReturnValue(Promise.resolve(null))
      return planService.getPlan(planId, store).catch((err) => {
        expect(err).toBeDefined()
      })
    })
  })
})
