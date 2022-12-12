import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class UserStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/user',
        method: OpenAPIV3.HttpMethods.PATCH,
        functionName: 'patchUser',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/user',
        method: OpenAPIV3.HttpMethods.DELETE,
        functionName: 'deleteUser',
        container: 'user',
        withDb: true,
        policies: [
          { actions: ['cognito-idp:AdminDisableUser', 'cognito-idp:AdminUserGlobalSignOut'], resources: ['*'] },
        ],
        cors: this.options.cors,
      },
      {
        path: '/user',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getUser',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/user/recover',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postUserRecover',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/user/history',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getUserHistory',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/user/migration',
        method: OpenAPIV3.HttpMethods.PATCH,
        functionName: 'patchUserMigration',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/user/plan',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getUserPlan',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/user/plan/history',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getUserPlanHistory',
        container: 'user',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
