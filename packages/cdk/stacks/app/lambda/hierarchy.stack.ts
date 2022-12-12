import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class HierarchyStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/hierarchy',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postHierarchy',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy',
        method: OpenAPIV3.HttpMethods.PATCH,
        functionName: 'patchHierarchy',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/list/owner',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getHierarchyListOwner',
        policies: [{ actions: ['s3:GetObject', 's3:GetObjectVersion'], resources: ['*'] }],
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/list/shared',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getHierarchyListShared',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/list/trashed',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getHierarchyListTrashed',
        policies: [{ actions: ['s3:GetObject', 's3:GetObjectVersion'], resources: ['*'] }],
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/list/preset',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getPresetList',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/{hierarchyId}',
        method: OpenAPIV3.HttpMethods.DELETE,
        functionName: 'deleteHierarchy',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/{hierarchyId}/permanent',
        method: OpenAPIV3.HttpMethods.DELETE,
        functionName: 'deleteHierarchyPermanently',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/{hierarchyId}/recover',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postHierarchyRecover',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/hierarchy/batch',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postHierarchyBatch',
        container: 'hierarchy',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
