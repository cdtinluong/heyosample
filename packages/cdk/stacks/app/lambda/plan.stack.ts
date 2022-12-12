import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class PlanStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/plan/{store}/list',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getPlanList',
        container: 'plan',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/plan/{store}/{planOrExternalId}',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getPlan',
        container: 'plan',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
