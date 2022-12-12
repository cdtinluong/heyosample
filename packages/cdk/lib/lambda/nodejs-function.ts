/* eslint-disable import/no-cycle */
import lambdaLayerCorePkg from '@layers/core/package.json'
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Architecture, LambdaInsightsVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import {
  BundlingOptions,
  Charset,
  NodejsFunction as AwsLambdaNodeJs,
  NodejsFunctionProps,
  OutputFormat,
} from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import merge from 'lodash/merge'
import * as path from 'path'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'
import { OpenAPIV3 } from 'openapi-types'
import { GenericSpecApiGateway } from '../apigateway/generic'

const lambdaLayerCoreDeps = Object.keys(lambdaLayerCorePkg.dependencies ?? {})

export interface ApiFunctionProps {
  api?: GenericSpecApiGateway
  path: string
  method: OpenAPIV3.HttpMethods
}

export class NodejsFunction extends AwsLambdaNodeJs {
  public props: NodejsFunctionProps

  public apiProps: ApiFunctionProps

  public constructor(
    scope: Construct,
    id: string,
    props: NodejsFunctionProps & { container: string },
    apiProps: ApiFunctionProps,
    installNodeModules?: string[],
  ) {
    const environment = {
      REGION: Stack.of(scope).region,
      AVAILABILITY_ZONES: JSON.stringify(Stack.of(scope).availabilityZones),
      ...(props.environment ?? {}),
    }

    const defaultProps: NodejsFunctionProps = {
      architecture: Architecture.ARM_64,
      awsSdkConnectionReuse: true,
      timeout: Duration.seconds(30), // set default to 30 due to api gateway timeout, for any lambda need to run longer, please override them
      insightsVersion: LambdaInsightsVersion.VERSION_1_0_135_0,
      entry: path.join(__dirname, `../../../functions/${props.container}/index.ts`),
      runtime: Runtime.NODEJS_16_X,
      handler: props.handler,
      functionName: props.functionName,
      environment,
      logRetention: RetentionDays.ONE_MONTH,
      tracing: Tracing.ACTIVE,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
        provisionedConcurrentExecutions: 1,
      },
      bundling: merge({}, {
        // minify: true,
        target: 'es2020',
        charset: Charset.UTF8,
        format: OutputFormat.CJS,
        externalModules: ['aws-sdk', '@aws-sdk', ...lambdaLayerCoreDeps, '@prisma/client', 'prisma'],
        nodeModules: installNodeModules,
      } as BundlingOptions),
    }
    const mProps = merge({}, defaultProps, props)
    super(scope, id, mProps)
    // Link the lambda to the API
    if (apiProps.api != null) apiProps.api.linkLambda(props.functionName ?? id, apiProps.path, apiProps.method, this)
    // Override the logical ID
    overrideLogicalId(this, AWS_RESOURCE_TYPE.LAMBDA.FUNCTION, props.functionName ?? id)

    // Save data
    this.props = props
    this.apiProps = apiProps
  }
}
