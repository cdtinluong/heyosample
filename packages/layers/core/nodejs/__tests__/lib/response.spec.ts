import { StatusCodes } from 'http-status-codes'
import createError from 'http-errors'
import { Response } from '../../lib/response'

type CustomError = Error & { status: number }

const errorMethodNames = [
  'BadRequest',
  'Unauthorized',
  'PaymentRequired',
  'Forbidden',
  'NotFound',
  'MethodNotAllowed',
  'NotAcceptable',
  'ProxyAuthenticationRequired',
  'RequestTimeout',
  'Conflict',
  'Gone',
  'LengthRequired',
  'PreconditionFailed',
  'PayloadTooLarge',
  'URITooLong',
  'UnsupportedMediaType',
  'RangeNotSatisfiable',
  'ExpectationFailed',
  'ImATeapot',
  'MisdirectedRequest',
  'UnprocessableEntity',
  'Locked',
  'FailedDependency',
  'TooEarly',
  'UpgradeRequired',
  'PreconditionRequired',
  'TooManyRequests',
  'RequestHeaderFieldsTooLarge',
  'UnavailableForLegalReasons',
  'InternalServerError',
  'NotImplemented',
  'BadGateway',
  'ServiceUnavailable',
  'GatewayTimeout',
  'HTTPVersionNotSupported',
  'VariantAlsoNegotiates',
  'InsufficientStorage',
  'LoopDetected',
  'BandwidthLimitExceeded',
  'NotExtended',
  'NetworkAuthenticationRequired',
]

describe('lib/Response', () => {
  const response = new Response()
  describe('method > body', () => {
    it('should return correct response with `statusCode` & stringified `body`', () => {
      const data = { username: 'my-username' }
      const res = response.body(200, data)
      expect.assertions(3)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(JSON.parse(res.body)).toEqual(data)
    })

    it('should return empty response with `statusCode` when data is null or undefined', () => {
      const res = response.body(201)
      expect.assertions(3)
      expect(res.statusCode).toEqual(201)
      expect(typeof res.body).toBe('string')
      expect(JSON.parse(res.body)).toEqual({})
    })
  })

  describe('method > Ok', () => {
    it('should return correct response', () => {
      const data = { username: 'my-username' }
      const res = response.Ok(data)
      expect.assertions(3)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(JSON.parse(res.body)).toEqual(data)
    })

    it('should return response with empty object when data is not provided', () => {
      const res = response.Ok()
      expect.assertions(3)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('should return correct response if data is a string', () => {
      const data = 'my-username'
      const res = response.Ok(data)
      expect.assertions(3)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(res.body).toEqual(data)
    })

    it('should return correct response if provide options without headers', () => {
      const data = { username: 'my-username' }
      const res = response.Ok(data, {})
      expect.assertions(3)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(JSON.parse(res.body)).toEqual(data)
    })

    it('should return correct response among with headers which set by instance', () => {
      const data = { username: 'my-username' }
      const mResponse = new Response()
      mResponse.setHeader('Content-Type', 'application/json')
      const res = mResponse.Ok(data)
      expect.assertions(4)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(res.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(res.body)).toEqual(data)
    })

    it('should return correct response among with headers in method options', () => {
      const data = { username: 'my-username' }
      const headers = { 'Content-Type': 'application/json' }
      const res = response.Ok(data, { headers })
      expect.assertions(4)
      expect(res.statusCode).toEqual(200)
      expect(typeof res.body).toBe('string')
      expect(res.headers).toEqual(headers)
      expect(JSON.parse(res.body)).toEqual(data)
    })
  })

  describe('other methods', () => {
    it('method > Created: should have empty body & valid status', () => {
      const res = response.Created()
      expect.assertions(3)
      expect(res.statusCode).toEqual(StatusCodes.CREATED)
      expect(typeof res.body).toBe('string')
      expect(res.body).toEqual('{}')
    })

    it('method > NoContent: should have empty body & valid status', () => {
      const res = response.NoContent()
      expect.assertions(3)
      expect(res.statusCode).toEqual(StatusCodes.NO_CONTENT)
      expect(typeof res.body).toBe('string')
      expect(res.body).toEqual('')
    })

    it('method > BadRequest: should create error response with corresponding message & status', () => {
      const res = response.BadRequest('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > Unauthorized: should create error response with corresponding message & status', () => {
      const res = response.Unauthorized('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > PaymentRequired: should create error response with corresponding message & status', () => {
      const res = response.PaymentRequired('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > Forbidden: should create error response with corresponding message & status', () => {
      const res = response.Forbidden('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > NotFound: should create error response with corresponding message & status', () => {
      const res = response.NotFound('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > MethodNotAllowed: should create error response with corresponding message & status', () => {
      const res = response.MethodNotAllowed('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > NotAcceptable: should create error response with corresponding message & status', () => {
      const res = response.NotAcceptable('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > ProxyAuthenticationRequired: should create error response with corresponding message & status', () => {
      const res = response.ProxyAuthenticationRequired('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > RequestTimeout: should create error response with corresponding message & status', () => {
      const res = response.RequestTimeout('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > Conflict: should create error response with corresponding message & status', () => {
      const res = response.Conflict('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > Gone: should create error response with corresponding message & status', () => {
      const res = response.Gone('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > LengthRequired: should create error response with corresponding message & status', () => {
      const res = response.LengthRequired('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > PreconditionFailed: should create error response with corresponding message & status', () => {
      const res = response.PreconditionFailed('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > PayloadTooLarge: should create error response with corresponding message & status', () => {
      const res = response.PayloadTooLarge('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > URITooLong: should create error response with corresponding message & status', () => {
      const res = response.URITooLong('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > UnsupportedMediaType: should create error response with corresponding message & status', () => {
      const res = response.UnsupportedMediaType('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > RangeNotSatisfiable: should create error response with corresponding message & status', () => {
      const res = response.RangeNotSatisfiable('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > ExpectationFailed: should create error response with corresponding message & status', () => {
      const res = response.ExpectationFailed('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > ImATeapot: should create error response with corresponding message & status', () => {
      const res = response.ImATeapot('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > MisdirectedRequest: should create error response with corresponding message & status', () => {
      const res = response.MisdirectedRequest('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > UnprocessableEntity: should create error response with corresponding message & status', () => {
      const res = response.UnprocessableEntity('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > Locked: should create error response with corresponding message & status', () => {
      const res = response.Locked('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > FailedDependency: should create error response with corresponding message & status', () => {
      const res = response.FailedDependency('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > TooEarly: should create error response with corresponding message & status', () => {
      const res = response.TooEarly('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > UpgradeRequired: should create error response with corresponding message & status', () => {
      const res = response.UpgradeRequired('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > PreconditionRequired: should create error response with corresponding message & status', () => {
      const res = response.PreconditionRequired('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > TooManyRequests: should create error response with corresponding message & status', () => {
      const res = response.TooManyRequests('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > RequestHeaderFieldsTooLarge: should create error response with corresponding message & status', () => {
      const res = response.RequestHeaderFieldsTooLarge('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > UnavailableForLegalReasons: should create error response with corresponding message & status', () => {
      const res = response.UnavailableForLegalReasons('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > InternalServerError: should create error response with corresponding message & status', () => {
      const res = response.InternalServerError('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > NotImplemented: should create error response with corresponding message & status', () => {
      const res = response.NotImplemented('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > BadGateway: should create error response with corresponding message & status', () => {
      const res = response.BadGateway('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > ServiceUnavailable: should create error response with corresponding message & status', () => {
      const res = response.ServiceUnavailable('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > GatewayTimeout: should create error response with corresponding message & status', () => {
      const res = response.GatewayTimeout('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > HTTPVersionNotSupported: should create error response with corresponding message & status', () => {
      const res = response.HTTPVersionNotSupported('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > VariantAlsoNegotiates: should create error response with corresponding message & status', () => {
      const res = response.VariantAlsoNegotiates('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > InsufficientStorage: should create error response with corresponding message & status', () => {
      const res = response.InsufficientStorage('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > LoopDetected: should create error response with corresponding message & status', () => {
      const res = response.LoopDetected('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > BandwidthLimitExceeded: should create error response with corresponding message & status', () => {
      const res = response.BandwidthLimitExceeded('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > NotExtended: should create error response with corresponding message & status', () => {
      const res = response.NotExtended('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })

    it('method > NetworkAuthenticationRequired: should create error response with corresponding message & status', () => {
      const res = response.NetworkAuthenticationRequired('{}')
      expect(JSON.parse(res.body)).toEqual({})
    })
  })
})
