import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class PollingStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/polling',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getPolling',
        container: 'polling',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
