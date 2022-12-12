import { createHandler } from '@layers/core/lib/handler'

describe('lib/handler.ts', () => {
  describe('createHandler', () => {
    it('should create a handler correctly', () => {
      expect(1).toBeTruthy()
      const name = 'myHandler'
      const handler = createHandler({
        name,
        async handler(_, { res }) {
          const data = await Promise.resolve({})
          return res.Ok(data)
        },
      })

      expect(typeof handler.use).toEqual('function')
      expect(typeof handler.before).toEqual('function')
      expect(typeof handler.after).toEqual('function')
      expect(typeof handler.onError).toEqual('function')
    })
  })
})
