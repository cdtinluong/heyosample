/* eslint-disable class-methods-use-this */
import { APIGatewayProxyResult } from 'aws-lambda'
import { StatusCodes } from 'http-status-codes'
import isEmpty from 'lodash/isEmpty'
import isString from 'lodash/isString'

interface OkMethodOptions {
  headers?: GenericObject
}

export class Response implements IResponse<APIGatewayProxyResult> {
  private headers: GenericObject = {}

  public body<T = unknown | any>(status: number, data?: T, options?: OkMethodOptions): APIGatewayProxyResult {
    const headers = options?.headers ?? this.headers

    const mData = data ?? {}
    const resp: APIGatewayProxyResult = {
      statusCode: status,
      body: isString(mData) ? mData : JSON.stringify(mData),
    }

    if (!isEmpty(headers)) {
      resp.headers = headers
    }

    return resp
  }

  public createErrorResponse(error: Error & { status: StatusCodes }): APIGatewayProxyResult {
    const statusCode = error instanceof Error ? error.status : StatusCodes.INTERNAL_SERVER_ERROR
    console.error(`[Error][Message] ${error.message}`, error)
    console.error(`[Error][Stack] ${error.stack}`)
    return {
      headers: this.headers,
      statusCode,
      body: '',
    }
  }

  public Ok<T = unknown | any>(data?: T, options?: OkMethodOptions): APIGatewayProxyResult {
    return this.body(StatusCodes.OK, data, options)
  }

  public Created<T = unknown | any>(data?: T, options?: OkMethodOptions): APIGatewayProxyResult {
    return this.body(StatusCodes.CREATED, data, options)
  }

  public NoContent(): APIGatewayProxyResult {
    return this.body(StatusCodes.NO_CONTENT, '')
  }

  public BadRequest(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.BAD_REQUEST, message)
  }

  public Unauthorized(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.UNAUTHORIZED, message)
  }

  public PaymentRequired(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.PAYMENT_REQUIRED, message)
  }

  public Forbidden(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.FORBIDDEN, message)
  }

  public NotFound(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.NOT_FOUND, message)
  }

  public MethodNotAllowed(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.METHOD_NOT_ALLOWED, message)
  }

  public NotAcceptable(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.NOT_ACCEPTABLE, message)
  }

  public ProxyAuthenticationRequired(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.PROXY_AUTHENTICATION_REQUIRED, message)
  }

  public RequestTimeout(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.REQUEST_TIMEOUT, message)
  }

  public Conflict(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.CONFLICT, message)
  }

  public Gone(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.GONE, message)
  }

  public LengthRequired(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.LENGTH_REQUIRED, message)
  }

  public PreconditionFailed(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.PRECONDITION_FAILED, message)
  }

  public PayloadTooLarge(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.REQUEST_TOO_LONG, message)
  }

  public URITooLong(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.REQUEST_URI_TOO_LONG, message)
  }

  public UnsupportedMediaType(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.UNSUPPORTED_MEDIA_TYPE, message)
  }

  public RangeNotSatisfiable(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.REQUESTED_RANGE_NOT_SATISFIABLE, message)
  }

  public ExpectationFailed(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.EXPECTATION_FAILED, message)
  }

  public ImATeapot(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.IM_A_TEAPOT, message)
  }

  public MisdirectedRequest(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.MISDIRECTED_REQUEST, message)
  }

  public UnprocessableEntity(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.UNPROCESSABLE_ENTITY, message)
  }

  public Locked(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.LOCKED, message)
  }

  public FailedDependency(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.FAILED_DEPENDENCY, message)
  }

  public TooEarly(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public UpgradeRequired(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public PreconditionRequired(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.PRECONDITION_REQUIRED, message)
  }

  public TooManyRequests(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.TOO_MANY_REQUESTS, message)
  }

  public RequestHeaderFieldsTooLarge(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.REQUEST_HEADER_FIELDS_TOO_LARGE, message)
  }

  public UnavailableForLegalReasons(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.UNAVAILABLE_FOR_LEGAL_REASONS, message)
  }

  public InternalServerError(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public NotImplemented(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.NOT_IMPLEMENTED, message)
  }

  public BadGateway(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.BAD_GATEWAY, message)
  }

  public ServiceUnavailable(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.SERVICE_UNAVAILABLE, message)
  }

  public GatewayTimeout(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.GATEWAY_TIMEOUT, message)
  }

  public HTTPVersionNotSupported(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.HTTP_VERSION_NOT_SUPPORTED, message)
  }

  public VariantAlsoNegotiates(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public InsufficientStorage(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INSUFFICIENT_STORAGE, message)
  }

  public LoopDetected(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public BandwidthLimitExceeded(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public NotExtended(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.INTERNAL_SERVER_ERROR, message)
  }

  public NetworkAuthenticationRequired(message: string): APIGatewayProxyResult {
    return this.body(StatusCodes.NETWORK_AUTHENTICATION_REQUIRED, message)
  }

  public setHeader(key: string, value: string): Response {
    this.headers[key] = value

    return this
  }
}
