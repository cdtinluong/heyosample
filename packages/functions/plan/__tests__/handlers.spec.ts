import { faker } from '@faker-js/faker'
import { Response } from '@layers/core/lib/response'
import { MigrationStatus } from '@layers/prisma'
import { PlanService } from '../services'
import { CustomCode } from '@layers/core/lib/code'

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
}

const deviceId = faker.datatype.uuid()
const ctx: any = { res: new Response() }
const event: any = {
  meta: {
    user: { id: faker.datatype.uuid(), email: 'test@test.com', given_name: faker.name, family_name: faker.name },
    deviceId,
  },
  params: {
    store: 'APP_STORE',
  },
}

const planService = Object.getPrototypeOf(new PlanService(prismaClient))
const getPlanSpy = jest.spyOn(planService, 'getPlan')
const getPlansSpy = jest.spyOn(planService, 'getPlans')

describe('plan/handlers.ts', () => {
  const planId = faker.datatype.uuid()
  const externalId = faker.datatype.string()
  const plan = {
    id: planId,
    externalId,
    options: { fileNb: 5 },
    description: 'Desc',
    advantages: ['Advantages 1'],
    advantagesDescription: 'Advantages Desc',
    isActive: true,
  }

  describe('GET /plans', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 200: Plans found', async () => {
      getPlansSpy.mockResolvedValue([plan])

      const { getPlanList } = await import('../handlers')
      const res = await getPlanList.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PLANS_RETRIEVED)
      expect(JSON.parse(String(res.body)).data).toEqual([plan])
    })

    it('Returns 200: No Plans in DB', async () => {
      getPlansSpy.mockResolvedValue([])

      const { getPlanList } = await import('../handlers')
      const res = await getPlanList.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PLANS_RETRIEVED)
      expect(JSON.parse(String(res.body)).data).toEqual([])
    })
  })

  describe('GET /plan/{planOrExternalId}', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 200: Plan found with planId', async () => {
      getPlanSpy.mockResolvedValue(plan)

      const { getPlan } = await import('../handlers')
      const res = await getPlan.handler(
        {
          ...event,
          params: { store: 'APP_STORE', planOrExternalId: planId },
        },
        ctx,
      )
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PLAN_RETRIEVED)
      expect(JSON.parse(String(res.body)).data).toEqual(plan)
    })

    it('Returns 200: Plan found with externalId', async () => {
      getPlanSpy.mockResolvedValue(plan)

      const { getPlan } = await import('../handlers')
      const res = await getPlan.handler(
        {
          ...event,
          params: { store: 'APP_STORE', planOrExternalId: externalId },
        },
        ctx,
      )
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PLAN_RETRIEVED)
      expect(JSON.parse(String(res.body)).data).toEqual(plan)
    })

    it('Returns 404: Plan not found', async () => {
      getPlanSpy.mockResolvedValue(null)

      const { getPlan } = await import('../handlers')
      const res = await getPlan.handler(
        {
          ...event,
          params: { store: 'APP_STORE', planOrExternalId: externalId },
        },
        ctx,
      )
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PLAN_NOT_FOUND)
    })
  })
})
