import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class WebhookStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/webhook/revenuecat',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postRevenueCat',
        container: 'webhook',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
