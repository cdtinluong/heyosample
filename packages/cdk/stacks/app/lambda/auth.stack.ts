import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class AuthStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/auth/login',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postAuthLogin',
        container: 'auth',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/auth/logout',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postAuthLogout',
        container: 'auth',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
