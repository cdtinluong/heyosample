import { Stack } from 'aws-cdk-lib'
import { ISecurityGroup, IVpc, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2'
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import env from 'cdk/lib/env'
import { AppStackProps } from 'cdk/lib/stack.interface'
import { createCoreLayer, createPrismaLayer, createFileLayer } from 'cdk/lib/lambda/layer'
import { normalizeLogicalId, wrapStringsWithQuote } from 'cdk/lib/utils'
import { Construct } from 'constructs'
import merge from 'lodash/merge'
import { APIGateway, LambdaStackOptions } from 'cdk/lib/apigateway/index'
import { BaseLambdaStack } from './lambda/base.stack'
import { UserStack } from './lambda/user.stack'
import { AuthStack } from './lambda/auth.stack'
import { FileStack } from './lambda/file.stack'
import { HierarchyStack } from './lambda/hierarchy.stack'
import { PollingStack } from './lambda/polling.stack'
import { WebhookStack } from './lambda/webhook.stack'
import { PlanStack } from './lambda/plan.stack'

export class AppStack extends Stack {
  protected lambdaStacks: { [key: string]: BaseLambdaStack }

  // vpc for app
  private vpc: IVpc

  private securityGroup: ISecurityGroup

  private options: LambdaStackOptions

  private coreLambdaLayer: LayerVersion

  private prismaLambdaLayer: LayerVersion

  private fileLambdaLayer: LayerVersion

  public constructor(private scope: Construct, private id: string, private props: AppStackProps) {
    super(scope, id, props)
    const baseVpcStackName = normalizeLogicalId(`${env.CROSS_REGION_STACK_NAME}-${this.region}-VPC`)
    // load vpc & security group
    this.getVpc(baseVpcStackName)
    this.getSecurityGroup(baseVpcStackName, this.vpc)
  }

  public async init() {
    const globalEnvironment = {
      STAGE: env.STAGE,
      STACK_NAME: env.STACK_NAME,
      RESOURCE_STACK_NAME: env.RESOURCE_STACK_NAME,
      SENTRY_DSN: env.SENTRY_DSN,
    }
    // Create resources
    const apis = await this.createApi(globalEnvironment)
    // Create lambda layers
    this.createLambdaLayers()
    // Create lambda
    this.createLambdaStacks()
    // After APIs are Finalized, no morw Lambdas can be added
    apis.finalizeApis([
      // The userpool ARN will be set to its proper value in the post-deployment script
      `arn:aws:cognito-idp:eu-west-1:${this.options.account}:userpool/${this.props.resources.cognito.userPoolName}`,
    ])
  }

  private getVpc(baseVpcStack: string) {
    const vpcName = `${baseVpcStack}-VPC-NEW`
    this.vpc = Vpc.fromLookup(this, vpcName, {
      vpcName,
      region: this.region,
    })
  }

  private getSecurityGroup(baseVpcStack: string, vpc: IVpc) {
    const sgName = `${baseVpcStack}-SG-NEW`
    this.securityGroup = SecurityGroup.fromLookupByName(this, sgName, sgName, vpc)
  }

  private async createApi(globalEnvironment: { [key: string]: string }): Promise<APIGateway> {
    // Create default options for the API
    this.options = {
      apis: undefined,
      stackName: env.STACK_NAME,
      region: Stack.of(this).region,
      account: Stack.of(this).account,
      environment: merge(globalEnvironment, {}),
      cors: {
        // TODO: move this to config file and use only dev.cloud.linerity.io
        // origins: ['https://demo.dev.cloud.linearity.io'],
        origins: ['*'],
        // origins: ['http:localhost:3000'],
        // TODO: Please validate this is all headers?
        headers: wrapStringsWithQuote(['x-device-id', 'Authorization', 'Content-Type']),
        credentials: true,
        requestMethods: '*',
      },
    }

    // Create the domain and API
    const apis = new APIGateway(this, 'ApiGateway', this.options)
    await apis.initializeApis()
    this.options.apis = apis.api
    return apis
  }

  private createLambdaLayers(): void {
    // Core layer
    this.coreLambdaLayer = createCoreLayer(this)

    // Prisma layer
    this.prismaLambdaLayer = createPrismaLayer(this)

    // File layer
    this.fileLambdaLayer = createFileLayer(this)
  }

  private getLayersWithPrisma() {
    return [this.coreLambdaLayer, this.prismaLambdaLayer]
  }

  private getLayersWithPrismaAndFile() {
    return [...this.getLayersWithPrisma(), this.fileLambdaLayer]
  }

  private createLambdaStacks(): void {
    const defaultEnv = { ...this.options.environment, RESOURCE_REGION: env.RESOURCE_REGION }
    this.lambdaStacks = {
      User: new UserStack(this, 'User', {
        ...this.options,
        environment: merge(defaultEnv, {
          COGNITO_USER_POOL_ID: env.COGNITO_USER_POOL_ID,
          BRAZE_API_KEY: env.BRAZE_API_KEY,
          BRAZE_REST_ENDPOINT: env.BRAZE_REST_ENDPOINT,
          BRAZE_APP_ID: env.BRAZE_APP_ID,
          BRAZE_SENDER_EMAIL: env.BRAZE_SENDER_EMAIL,
        }),
        layers: this.getLayersWithPrisma(),
        stackName: 'User',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
      Auth: new AuthStack(this, 'Auth', {
        ...this.options,
        environment: merge(defaultEnv, {
          AMPLITUDE_API_KEY: env.AMPLITUDE_API_KEY,
          AMPLITUDE_BASE_URL: env.AMPLITUDE_BASE_URL,
          AMPLITUDE_API_SECRET: env.AMPLITUDE_API_SECRET,
        }),
        layers: this.getLayersWithPrisma(),
        stackName: 'Auth',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
      File: new FileStack(this, 'File', {
        ...this.options,
        environment: merge(defaultEnv, {
          MRAP_ARN: env.MRAP_ARN,
        }),
        layers: this.getLayersWithPrismaAndFile(),
        stackName: 'File',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
      Hierarchy: new HierarchyStack(this, 'Hierarchy', {
        ...this.options,
        environment: defaultEnv,
        layers: this.getLayersWithPrismaAndFile(),
        stackName: 'Hierarchy',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
      Polling: new PollingStack(this, 'Polling', {
        ...this.options,
        environment: defaultEnv,
        layers: this.getLayersWithPrisma(),
        stackName: 'Polling',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
      Webhook: new WebhookStack(this, 'Webhook', {
        ...this.options,
        environment: merge(defaultEnv, {
          BRAZE_API_KEY: env.BRAZE_API_KEY,
          BRAZE_REST_ENDPOINT: env.BRAZE_REST_ENDPOINT,
          BRAZE_APP_ID: env.BRAZE_APP_ID,
          BRAZE_SENDER_EMAIL: env.BRAZE_SENDER_EMAIL,
        }),
        layers: this.getLayersWithPrisma(),
        stackName: 'Webhook',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
      Plan: new PlanStack(this, 'Plan', {
        ...this.options,
        environment: defaultEnv,
        layers: this.getLayersWithPrisma(),
        stackName: 'Plan',
        vpc: this.vpc,
        securityGroup: this.securityGroup,
      }),
    }

    this.overrideStackLogicalIds()
  }

  private overrideStackLogicalIds(): void {
    Object.keys(this.lambdaStacks).forEach((stack) => {
      if (Object.prototype.hasOwnProperty.call(this.lambdaStacks, stack)) {
        this.lambdaStacks[stack].nestedStackResource?.overrideLogicalId(stack)
      }
    })
  }
}
