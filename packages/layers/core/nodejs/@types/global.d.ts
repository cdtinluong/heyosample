type User = {
  id: string
  email: string
  given_name: string
  family_name: string
}

type ProxyEventMetaData = {
  user: User
  token: string
  deviceId: string
  [key: string]: any
}

interface GenericObject {
  [key: string]: string
}

interface IResponse<R> {
  body<T = any>(status: number, data: T): R
  createErrorResponse(error: Error & { status: number }): R
  Ok(data: any): R
  Created(): R
  NoContent(): R
  BadRequest(message?: string): R
  Unauthorized(message?: string): R
  PaymentRequired(message?: string): R
  Forbidden(message?: string): R
  NotFound(message?: string): R
  MethodNotAllowed(message?: string): R
  NotAcceptable(message?: string): R
  ProxyAuthenticationRequired(message?: string): R
  RequestTimeout(message?: string): R
  Conflict(message?: string): R
  Gone(message?: string): R
  LengthRequired(message?: string): R
  PreconditionFailed(message?: string): R
  PayloadTooLarge(message?: string): R
  URITooLong(message?: string): R
  UnsupportedMediaType(message?: string): R
  RangeNotSatisfiable(message?: string): R
  ExpectationFailed(message?: string): R
  ImATeapot(message?: string): R
  MisdirectedRequest(message?: string): R
  UnprocessableEntity(message?: string): R
  Locked(message?: string): R
  FailedDependency(message?: string): R
  TooEarly(message?: string): R
  UpgradeRequired(message?: string): R
  PreconditionRequired(message?: string): R
  TooManyRequests(message?: string): R
  RequestHeaderFieldsTooLarge(message?: string): R
  UnavailableForLegalReasons(message?: string): R
  InternalServerError(message?: string): R
  NotImplemented(message?: string): R
  BadGateway(message?: string): R
  ServiceUnavailable(message?: string): R
  GatewayTimeout(message?: string): R
  HTTPVersionNotSupported(message?: string): R
  VariantAlsoNegotiates(message?: string): R
  InsufficientStorage(message?: string): R
  LoopDetected(message?: string): R
  BandwidthLimitExceeded(message?: string): R
  NotExtended(message?: string): R
  NetworkAuthenticationRequired(message?: string): R
}

interface Error {
  name?: string
  expose?: boolean
  statusCode?: number
}
