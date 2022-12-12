import { OpenAPIV3 } from 'openapi-types'
import { BaseLambdaStack, Lambda } from './base.stack'

export class FileStack extends BaseLambdaStack {
  protected getLambdas(): Lambda[] {
    return [
      {
        path: '/file/{fileId}/download',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postFileDownload',
        container: 'file',
        policies: [{ actions: ['s3:GetObject', 's3:GetObjectVersion'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}/upload',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postFileUpload',
        container: 'file',
        policies: [{ actions: ['s3:PutObject'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}/upload/complete',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postFileUploadComplete',
        container: 'file',
        policies: [{ actions: ['s3:PutObject'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}/upload/abort',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postFileUploadAbort',
        container: 'file',
        policies: [{ actions: ['s3:AbortMultipartUpload'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getFile',
        container: 'file',
        policies: [{ actions: ['s3:GetObject', 's3:GetObjectVersion'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}/conflict/resolve',
        method: OpenAPIV3.HttpMethods.POST,
        functionName: 'postFileConflictResolve',
        container: 'file',
        policies: [{ actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}/content/{fileContentId}',
        method: OpenAPIV3.HttpMethods.DELETE,
        functionName: 'deleteFileContent',
        container: 'file',
        policies: [{ actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'], resources: ['*'] }],
        withDb: true,
        cors: this.options.cors,
      },
      {
        path: '/file/{fileId}/conflict',
        method: OpenAPIV3.HttpMethods.GET,
        functionName: 'getFileConflict',
        container: 'file',
        withDb: true,
        cors: this.options.cors,
      },
    ]
  }
}
