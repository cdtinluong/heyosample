import { NestedStack } from 'aws-cdk-lib'
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { createPolicyStatement } from 'cdk/lib/iam/iam'
import { NodejsFunction } from 'cdk/lib/lambda/nodejs-function'
import { LambdaStackOptions } from 'cdk/lib/apigateway/index'
import { Construct } from 'constructs'
import { OpenAPIV3 } from 'openapi-types'
import env from 'cdk/lib/env'
import { CorsOption } from '../../../lib/apigateway/interface'

export interface Policy {
  actions: string[]
  resources: string[]
}

export interface Lambda {
  path: string
  method: OpenAPIV3.HttpMethods
  container: string
  functionName: string
  withDb: boolean
  cors?: CorsOption
  nodeModules?: string[]
  policies?: Policy[]
}

export abstract class BaseLambdaStack extends NestedStack {
  protected layers?: LayerVersion[]

  protected rootPath: string

  private rawStackId: string

  public constructor(private readonly scope: Construct, protected id: string, protected options: LambdaStackOptions) {
    super(scope, id)

    this.layers = this.options.layers
    this.rootPath = this.options.apiPathPrefix ?? ''

    this.create()
  }

  public route(subPath: string) {
    return `${this.rootPath}/${subPath.replace(/^[\\/]/, '')}`
  }

  // Define all endpoints
  protected create(): void {
    const lambdas = this.getLambdas()
    lambdas.forEach((lambda) => this.createAPIFunction(lambda))
  }

  protected createAPIFunction(lambda: Lambda) {
    const funcParams = {
      ...this.options.environment,
    }

    if (lambda.cors != null) {
      // add CORS settings to lambda environment
      funcParams.CORS = JSON.stringify(lambda.cors)
    }

    const nodeJSFunc = new NodejsFunction(
      this.scope,
      lambda.functionName,
      {
        container: lambda.container,
        functionName: `${env.STACK_NAME}-${lambda.method.toUpperCase()}-${lambda.functionName}`,
        layers: this.layers,
        environment: funcParams,
        handler: lambda.functionName,
        vpc: this.options.vpc,
        securityGroups: this.options.securityGroup ? [this.options.securityGroup] : undefined,
      },
      {
        path: lambda.path,
        api: this.options.apis?.lincloud,
        method: lambda.method,
      },
      lambda.nodeModules,
    )
    // .currentVersion // https://github.com/aws/aws-cdk/issues/13731 - It's the only way to force the creation of a version and provisionedConccurentExecutions

    if (lambda.withDb) {
      nodeJSFunc.addToRolePolicy(
        createPolicyStatement(
          [
            'secretsmanager:DescribeSecret',
            'secretsmanager:GetSecretValue',
            'rds:DescribeDBProxies',
            'rds:DescribeDBProxyEndpoints',
          ],
          ['*'],
        ),
      )
    }
    if (lambda.policies && lambda.policies.length > 0) {
      lambda.policies.forEach((policy) =>
        nodeJSFunc.addToRolePolicy(createPolicyStatement(policy.actions, policy.resources)),
      )
    }
  }

  protected abstract getLambdas(): Lambda[]
}
