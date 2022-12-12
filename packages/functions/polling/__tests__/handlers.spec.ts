import { faker } from '@faker-js/faker'
import { Response } from '@layers/core/lib/response'
import { PollingService } from '../services'
import { CustomCode } from '@layers/core/lib/code'
import { getPolling } from '../handlers'

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
}

const ctx: any = {
  res: new Response(),
  prisma: prismaClient,
}

const pollingService = Object.getPrototypeOf(new PollingService(prismaClient))
const getPollingSpy = jest.spyOn(pollingService, 'getPolling')
const userId = faker.datatype.uuid()
const deviceId = faker.datatype.uuid()

const event: any = { meta: { user: { id: userId } } }

describe('polling/handlers', () => {
  describe('GET /polling?lastUpdated=xxxx', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Return 200: get data successfully', async () => {
      const lastUpdated = new Date().toISOString()
      event.params = { lastUpdated }
      const pollingData = {
        items: [{ id: faker.datatype.uuid(), action: 'created', deviceId, item: 'user' }],
        next: 'sample-token',
      }
      getPollingSpy.mockResolvedValue(pollingData)
      const res = await getPolling.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual(pollingData)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.POLLING_SUCCESS)
      expect(JSON.parse(String(res.body)).message).toEqual('Polling retrieved')
    })

    it('Return 400: when invalid date', async () => {
      event.params = { lastUpdated: 'invalid date' }
      const pollingData = [{ id: faker.datatype.uuid(), action: 'created', deviceId, item: 'user' }]
      getPollingSpy.mockResolvedValue(pollingData)
      const res = await getPolling.handler(event, ctx)
      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).message).toContain('Invalid lastUpdated iso UTC date')
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.POLLING_FAILED)
    })

    it('Return 400: when invalid iso string date', async () => {
      event.params = { lastUpdated: '2022-10-20' }
      const pollingData = [{ id: faker.datatype.uuid(), action: 'created', deviceId, item: 'user' }]
      getPollingSpy.mockResolvedValue(pollingData)
      const res = await getPolling.handler(event, ctx)
      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).message).toContain('Invalid lastUpdated iso UTC date')
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.POLLING_FAILED)
    })
  })
})
