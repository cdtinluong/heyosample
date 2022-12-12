/* eslint-disable import/no-cycle */
import SwaggerParser from '@apidevtools/swagger-parser'
import { Stack, RemovalPolicy } from 'aws-cdk-lib'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { SpecRestApi, ApiDefinition, MethodLoggingLevel, LogGroupLogDestination } from 'aws-cdk-lib/aws-apigateway'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { OpenAPIV3 } from 'openapi-types'
import tempy from 'tempy'

import { ApiProperties, ICorsResourceProps, RoleObject, SingleApiGatewayProps } from 'cdk/lib/apigateway/interface'
import { fixOpenApiDefinition } from 'cdk/lib/apigateway/nullable'
import { hasOwnProperty, overrideLogicalId, AWS_RESOURCE_TYPE, wrapStringsWithQuote } from 'cdk/lib/utils'
import { NodejsFunction } from '../lambda/nodejs-function'

type OpenApiResourceIntergration = OpenAPIV3.PathsObject<{
  'x-amazon-apigateway-integration': ICorsResourceProps & ApiProperties['x-amazon-apigateway-integration']
}>[string]

export class GenericSpecApiGateway {
  // Will be assigned in the `SingleApiGateway.initialize` method
  private document!: OpenAPIV3.Document<ApiProperties>

  // Will be assigned in the `SingleApiGateway.initialize` method
  private originalPaths!: OpenAPIV3.PathsObject<ApiProperties>

  private role: RoleObject

  private lambdas: NodejsFunction[] = []

  /**
   * Indicates if this api was finalized.
   * If the API is finalized, no more modifications are possible.
   */
  private finalized = false

  private defaultCorsSettings: {
    'method.response.header.Access-Control-Allow-Credentials'?: string | boolean
    'method.response.header.Access-Control-Allow-Headers'?: string
    'method.response.header.Access-Control-Allow-Origin': string
  }

  private constructor(
    public scope: Stack,
    public stackName: string,
    public apiName: string,
    public baseName: string,
    public props: SingleApiGatewayProps,
  ) {
    this.role = this.createApiRole()
    this.initDefaultCors()
  }

  public static async initialize(
    scope: Stack,
    stackName: string,
    apiName: string,
    apiFilePath: string,
    baseName: string,
    props: SingleApiGatewayProps,
  ): Promise<GenericSpecApiGateway> {
    const instance = new GenericSpecApiGateway(scope, stackName, apiName, baseName, props)
    instance.document = await GenericSpecApiGateway.getDocument(apiFilePath)
    instance.originalPaths = instance.document.paths
    instance.document.paths = {}

    return instance
  }

  private static getApiList(paths: OpenAPIV3.PathsObject<ApiProperties>): Map<string, Set<OpenAPIV3.HttpMethods>> {
    const map = new Map<string, Set<OpenAPIV3.HttpMethods>>()
    const httpMethods = Object.values(OpenAPIV3.HttpMethods)
    Object.entries(paths).forEach(([route, props]) => {
      if (props == null) return
      const methods = Object.keys(props).filter((prop) =>
        httpMethods.includes(prop as OpenAPIV3.HttpMethods),
      ) as OpenAPIV3.HttpMethods[]
      map.set(route, new Set(methods))
    })
    return map
  }

  private static async getDocument(path: string): Promise<OpenAPIV3.Document<ApiProperties>> {
    const api = await SwaggerParser.parse(path, {
      dereference: { circular: 'ignore' },
    })
    // console.log('API name: %s, Version: %s', api.info.title, api.info.version)
    if (api.paths == null) throw new Error('No paths found in the API')

    if (!hasOwnProperty(api, 'openapi') || typeof api.openapi !== 'string')
      throw new Error('No openapi version found in the API')

    if (api.openapi.startsWith('3.') === false) throw new Error('Unsupported openapi version')

    return api as OpenAPIV3.Document<ApiProperties>
  }

  private static substractSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>(set1)
    set2.forEach((value) => result.delete(value))
    return result
  }

  public linkLambda(functionName: string, path: string, method: OpenAPIV3.HttpMethods, fn: NodejsFunction): void {
    if (this.finalized) throw new Error('API is already finalized')
    if (this.document.paths[path]?.[method] != null) {
      throw new Error(`${method} ${path} already defined`)
    }

    const methodObj = this.originalPaths[path]?.[method]
    if (methodObj === undefined) {
      throw new Error(`${method} ${path} not found in OpenApi File`)
    }

    const arn = `arn:aws:lambda:${this.props.region}:${this.props.account}:function:${functionName}`
    methodObj['x-amazon-apigateway-integration'] = {
      httpMethod: 'POST',
      type: 'aws_proxy',
      uri: `arn:aws:apigateway:${this.props.region}:lambda:path/2015-03-31/functions/${arn}/invocations`,
      credentials: `arn:aws:iam::${this.props.account}:role/${this.role.roleName}`,
    }

    // Add the original path object (except methods) back
    let pathObj = this.document.paths[path]
    if (this.document.paths[path] == null) {
      // copy the path object
      pathObj = {
        ...this.originalPaths[path],
      }
      // remove all methods
      Object.values(OpenAPIV3.HttpMethods).forEach((m) => {
        // we just set it 2 lines above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        delete pathObj![m]
      })
    }
    // Add functions to globals array
    this.lambdas.push(fn)
    // Add our method to the path
    // Disabling rule - we set it in the if it was undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    pathObj![method] = methodObj
    this.document.paths[path] = pathObj

    // add cors options method
    if (this.props.cors != null) {
      // get the cors for current path
      const optionPath = this.getCorsResource(pathObj, methodObj.operationId)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // TODO: how to ignore this error
      pathObj.options = optionPath
    }
  }

  public linkMock(): void {
    Object.entries(this.originalPaths).forEach(([path, props]) => {
      if (props == null) return
      Object.entries(props).forEach(([method, properties]) => {
        if (properties === null || properties === undefined) return
        const propObj = properties as OpenAPIV3.OperationObject<ApiProperties>
        if (propObj['x-amazon-apigateway-integration'] == null) return
        // If we're implementing a mock, we add it to the document to be deployed
        if (propObj['x-amazon-apigateway-integration'].type === 'mock') {
          let pathObj = this.document.paths[path]
          if (this.document.paths[path] == null) {
            // Copy the path object
            pathObj = {
              ...this.originalPaths[path],
            }
            // Remove all methods
            Object.values(OpenAPIV3.HttpMethods).forEach((m) => {
              // We just set it 2 lines above
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              delete pathObj![m]
            })
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          pathObj![method as OpenAPIV3.HttpMethods] = properties as OpenAPIV3.OperationObject<ApiProperties>
          this.document.paths[path] = pathObj
        }
      })
    })
  }

  public setCognitoAuthorizer(userPoolARNs: string[]): void {
    if (this.finalized) throw new Error('API is already finalized')
    if (this.document.components == null) this.document.components = {}

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const authorizer =
      // @ts-expect-error // this is an x- extension, it is not typed correctly
      this.document.components?.securitySchemes?.defaultUserPool?.['x-amazon-apigateway-authorizer']
    if (authorizer == null) {
      throw new Error('No authorizer found in the API')
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    authorizer.providerARNs = userPoolARNs
  }

  public getMissingPaths(): Map<string, Set<OpenAPIV3.HttpMethods>> {
    const originalPaths = GenericSpecApiGateway.getApiList(this.originalPaths)
    const newPaths = GenericSpecApiGateway.getApiList(this.document.paths)

    const missingPaths = new Map<string, Set<OpenAPIV3.HttpMethods>>()
    originalPaths.forEach((methodsOriginal, path) => {
      const methods = newPaths.get(path)
      if (methods == null) {
        missingPaths.set(path, methodsOriginal)
        return
      }

      const missingMethods = GenericSpecApiGateway.substractSets(methodsOriginal, methods)
      if (missingMethods.size > 0) {
        missingPaths.set(path, missingMethods)
      }
    })

    return missingPaths
  }

  public finalize(): SpecRestApi {
    if (this.finalized) throw new Error('API is already finalized')
    this.finalized = true

    // Link mock integrations
    this.linkMock()

    // TODO: abort here maybe
    const missing = this.getMissingPaths()
    missing.forEach((methods, path) =>
      console.log(`[${this.stackName}-${this.apiName}] ${path} is missing ${[...methods].join(', ')}`),
    )

    // perform nullable fix
    fixOpenApiDefinition(this.document)

    const file = tempy.writeSync(JSON.stringify(this.document, null, 2))
    console.log(`API name: ${this.apiName}, API file: ${file}`)

    const stageName = 'prod'
    const logGroupName = `${this.stackName}-${this.props.region}-${this.apiName}-${stageName}`
    const logGroup = new LogGroup(this.scope, `${this.stackName}-${this.apiName}-${stageName}`, {
      logGroupName,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    overrideLogicalId(logGroup, AWS_RESOURCE_TYPE.LOGS.LOG_GROUP, logGroupName)

    const specRestApiName = `${this.stackName}-${this.apiName}`
    const specRestApi = new SpecRestApi(this.scope, specRestApiName, {
      restApiName: specRestApiName,
      apiDefinition: ApiDefinition.fromAsset(file),
      cloudWatchRole: true,
      deploy: true,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(logGroup),
        stageName,
        dataTraceEnabled: true,
        loggingLevel: MethodLoggingLevel.INFO,
        metricsEnabled: true,
        tracingEnabled: true,
      },
      retainDeployments: false,
    })
    overrideLogicalId(specRestApi, AWS_RESOURCE_TYPE.API_GATEWAY.REST_API, specRestApiName)

    // Link the Api Gateway to the lambda associated
    this.lambdas.forEach((lambda: NodejsFunction) => {
      lambda.addPermission(
        `${this.stackName}-${this.props.region}-${lambda.props.functionName}-Permission-${this.apiName}`,
        {
          principal: new ServicePrincipal('apigateway.amazonaws.com'),
          action: 'lambda:InvokeFunction',
          sourceArn: specRestApi.arnForExecuteApi(lambda.apiProps.method.toUpperCase(), lambda.apiProps.path),
        },
      )
    })
    return specRestApi
  }

  private getCorsResource(pathObject: OpenApiResourceIntergration, operationId?: string): OpenApiResourceIntergration {
    if (pathObject == null) throw new Error('Nullish path api object')
    // check if the method for path exists
    const corsMethod = pathObject[OpenAPIV3.HttpMethods.OPTIONS]
    if (corsMethod != null) return corsMethod // return existing one

    return this.getCorsResourceTemplate(
      ['*'], // @TODO: only allow which apis from swagger
      operationId,
      this.defaultCorsSettings['method.response.header.Access-Control-Allow-Headers'],
    )
  }

  private createApiRole(): RoleObject {
    const roleName = `${this.stackName}-${this.props.region}-APGWRoleAssumeLambda-${this.apiName}`
    const apiRole = new Role(this.scope, roleName, {
      roleName,
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    })
    overrideLogicalId(apiRole, AWS_RESOURCE_TYPE.IAM.ROLE, roleName)

    apiRole.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['lambda:InvokeFunction', 'lambda:InvokeAsync'],
      }),
    )
    return {
      role: apiRole,
      roleName,
    }
  }

  private initDefaultCors() {
    const { cors } = this.props
    if (cors == null) return
    this.defaultCorsSettings = {
      'method.response.header.Access-Control-Allow-Credentials': cors.credentials,
      'method.response.header.Access-Control-Allow-Headers': cors.headers,
      'method.response.header.Access-Control-Allow-Origin': wrapStringsWithQuote(cors.origins),
    }
  }

  private getCorsResourceTemplate(methods: string[], operationId?: string, header?: string) {
    return {
      operationId,
      summary: 'CORS support',
      description: 'Enable CORS by returning correct headers',
      tags: ['CORS'],
      responses: {
        '200': {
          description: 'Default response for CORS method',
          headers: {
            'Access-Control-Allow-Origin': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Methods': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Headers': {
              schema: {
                type: 'string',
              },
            },
            'Access-Control-Allow-Credentials': {
              schema: {
                type: 'boolean',
              },
            },
            content: {},
          },
        },
      },
      'x-amazon-apigateway-integration': {
        responses: {
          default: {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Methods': wrapStringsWithQuote(methods),
              'method.response.header.Access-Control-Allow-Headers': header,
              'method.response.header.Access-Control-Allow-Origin':
                this.defaultCorsSettings['method.response.header.Access-Control-Allow-Origin'],
              'method.response.header.Access-Control-Allow-Credentials':
                this.defaultCorsSettings['method.response.header.Access-Control-Allow-Credentials'],
            },
            responseTemplates: {
              'application/json': '{}',
            },
          },
        },
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
        passthroughBehavior: 'when_no_match',
        type: 'mock',
      },
    }
  }
}
