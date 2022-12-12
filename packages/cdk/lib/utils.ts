import { Duration, Stack } from 'aws-cdk-lib'
import { CfnAuthorizer, CfnRestApi, CfnStage, CfnUsagePlan, CfnDomainName } from 'aws-cdk-lib/aws-apigateway'
import { CfnComputeEnvironment, CfnJobDefinition, CfnJobQueue } from 'aws-cdk-lib/aws-batch'
import { CfnCustomResource, CfnStack } from 'aws-cdk-lib/aws-cloudformation'
import { CfnUserPool, CfnUserPoolClient } from 'aws-cdk-lib/aws-cognito'
import { CfnSecurityGroup, CfnVPC, CfnVPCPeeringConnection } from 'aws-cdk-lib/aws-ec2'
import { CfnRule } from 'aws-cdk-lib/aws-events'
import { CfnInstanceProfile, CfnPolicy, CfnRole, CfnUser } from 'aws-cdk-lib/aws-iam'
import { CfnFunction, CfnLayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Charset, NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { CfnDBCluster, CfnDBProxyEndpoint } from 'aws-cdk-lib/aws-rds'
import { CfnBucket, CfnBucketPolicy, CfnMultiRegionAccessPoint } from 'aws-cdk-lib/aws-s3'
import { CfnSecret, Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { CfnSubscription, CfnTopic, CfnTopicPolicy } from 'aws-cdk-lib/aws-sns'
import { CfnQueue } from 'aws-cdk-lib/aws-sqs'
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnDataSource, CfnGraphQLApi, CfnGraphQLSchema } from 'aws-cdk-lib/aws-appsync'
import { CfnHealthCheck, CfnRecordSet } from 'aws-cdk-lib/aws-route53'
import { CfnKey } from 'aws-cdk-lib/aws-kms'
import { IConstruct } from 'constructs'
import merge from 'lodash/merge'

import { AuroraCredentials, MultiStackProps } from './stack.interface'

export interface ResourceType {
  [key: string]: Record<string, string>
}

export const AWS_RESOURCE_TYPE: ResourceType = {
  CLOUD_FORMATION: {
    CUSTOM_RESOURCE: 'AWS::CloudFormation::CustomResource',
    STACK: 'AWS::CloudFormation::Stack',
  },
  LAMBDA: {
    FUNCTION: 'AWS::Lambda::Function',
    LAYER_VERSION: 'AWS::Lambda::LayerVersion',
  },
  API_GATEWAY: {
    REST_API: 'AWS::ApiGateway::RestApi',
    STAGE: 'AWS::ApiGateway::Stage',
    USAGE_PLAN: 'AWS::ApiGateway::UsagePlan',
    AUTHORIZER: 'AWS::ApiGateway::Authorizer',
    DOMAIN_NAME: 'AWS::ApiGateway::DomainName',
  },
  IAM: {
    USER: 'AWS::IAM::User',
    ROLE: 'AWS::IAM:Role',
    POLICY: 'AWS::IAM::Policy',
    INSTANCE_PROFILE: 'AWS::IAM::InstanceProfile',
  },
  S3: {
    BUCKET: 'AWS::S3::Bucket',
    POLICY: 'AWS::S3::BucketPolicy',
    MULTI_REGION_ACCESS_POINT: 'AWS::S3::MultiRegionAccessPoint',
  },
  SNS: {
    TOPIC: 'AWS::SNS::Topic',
    SUBSCRIPTION: 'AWS::SNS::Subscription',
    TOPIC_POLICY: 'AWS::SNS::TopicPolicy',
  },
  SQS: {
    QUEUE: 'AWS::SQS::Queue',
  },
  RDS: {
    DB_CLUSTER: 'AWS::RDS::DBCluster',
    DB_PROXY_ENDPOINT: 'AWS::RDS::DBProxyEndpoint',
  },
  SECRETS_MANAGER: {
    SECRET: 'AWS::SecretsManager::Secret',
  },
  COGNITO: {
    USER_POOL: 'AWS::Cognito::UserPool',
    USER_POOL_CLIENT: 'AWS::Cognito::UserPoolClient',
  },
  EC2: {
    VPC: 'AWS::EC2::VPC',
    SECURITY_GROUP: 'AWS::EC2::SecurityGroup',
    VPC_PEERING_CONNECTION: 'AWS::EC2::VPCPeeringConnection',
  },
  BATCH: {
    JOB_QUEUE: 'AWS::Batch::JobQueue',
    JOB_DEFINITION: 'AWS::Batch::JobDefinition',
    COMPUTE_ENVIRONMENT: 'AWS::Batch::ComputeEnvironment',
  },
  EVENTS: {
    RULE: 'AWS::Events::Rule',
  },
  LOGS: {
    LOG_GROUP: 'AWS::Logs::LogGroup',
  },
  APP_SYNC: {
    GRAPH_API: 'AWS::AppSync::GraphQLApi',
    GRAPH_SCHEMA: 'AWS::AppSync::GraphQLSchema',
    DATA_SOURCE: 'AWS::AppSync::DataSource',
  },
  ROUTE_53: {
    HEALTH_CHECK: 'AWS::Route53::HealthCheck',
    RECORD_SET: 'AWS::Route53::RecordSet',
  },
  KMS: {
    KEY: 'AWS::KMS::Key',
  },
}

export function buildArn(service: string, resourceName: string, props: MultiStackProps): string {
  return `arn:aws:${service}:${props.region}:${props.account}:${resourceName}`
}

// eslint-disable-next-line complexity
export function overrideLogicalId(resource: IConstruct, type: string, logicalId: string) {
  let cfResource
  // We check if the resource is already a Cfn*
  let tempResource = resource.node.defaultChild
  if (resource.node.children.length === 0 && !tempResource) {
    tempResource = resource
  }

  switch (type) {
    // Cloud formation
    case AWS_RESOURCE_TYPE.CLOUD_FORMATION.CUSTOM_RESOURCE:
      cfResource = tempResource as CfnCustomResource
      break
    case AWS_RESOURCE_TYPE.CLOUD_FORMATION.STACK:
      cfResource = tempResource as CfnStack
      break
    // Lambda
    case AWS_RESOURCE_TYPE.LAMBDA.FUNCTION:
      cfResource = tempResource as CfnFunction
      break
    case AWS_RESOURCE_TYPE.LAMBDA.LAYER_VERSION:
      cfResource = tempResource as CfnLayerVersion
      break
    // API Gateway
    case AWS_RESOURCE_TYPE.API_GATEWAY.REST_API:
      cfResource = tempResource as CfnRestApi
      break
    case AWS_RESOURCE_TYPE.API_GATEWAY.STAGE:
      cfResource = tempResource as CfnStage
      break
    case AWS_RESOURCE_TYPE.API_GATEWAY.USAGE_PLAN:
      cfResource = tempResource as CfnUsagePlan
      break
    case AWS_RESOURCE_TYPE.API_GATEWAY.AUTHORIZER:
      cfResource = tempResource as CfnAuthorizer
      break
    case AWS_RESOURCE_TYPE.API_GATEWAY.DOMAIN_NAME:
      cfResource = tempResource as CfnDomainName
      break
    // IAM
    case AWS_RESOURCE_TYPE.IAM.USER:
      cfResource = tempResource as CfnUser
      break
    case AWS_RESOURCE_TYPE.IAM.ROLE:
      cfResource = tempResource as CfnRole
      break
    case AWS_RESOURCE_TYPE.IAM.POLICY:
      cfResource = tempResource as CfnPolicy
      break
    case AWS_RESOURCE_TYPE.IAM.INSTANCE_PROFILE:
      cfResource = tempResource as CfnInstanceProfile
      break
    // S3
    case AWS_RESOURCE_TYPE.S3.BUCKET:
      cfResource = tempResource as CfnBucket
      break
    case AWS_RESOURCE_TYPE.S3.POLICY:
      cfResource = tempResource as CfnBucketPolicy
      break
    case AWS_RESOURCE_TYPE.S3.MULTI_REGION_ACCESS_POINT:
      cfResource = tempResource as CfnMultiRegionAccessPoint
      break
    // SNS
    case AWS_RESOURCE_TYPE.SNS.TOPIC:
      cfResource = tempResource as CfnTopic
      break
    case AWS_RESOURCE_TYPE.SNS.SUBSCRIPTION:
      cfResource = tempResource as CfnSubscription
      break
    case AWS_RESOURCE_TYPE.SNS.TOPIC_POLICY:
      cfResource = tempResource as CfnTopicPolicy
      break
    // SQS
    case AWS_RESOURCE_TYPE.SQS.QUEUE:
      cfResource = tempResource as CfnQueue
      break
    // RDS
    case AWS_RESOURCE_TYPE.RDS.DB_CLUSTER:
      cfResource = tempResource as CfnDBCluster
      break
    case AWS_RESOURCE_TYPE.RDS.DB_PROXY_ENDPOINT:
      cfResource = tempResource as CfnDBProxyEndpoint
      break
    // SECRETS MANAGER
    case AWS_RESOURCE_TYPE.SECRETS_MANAGER.SECRET:
      cfResource = tempResource as CfnSecret
      break
    // COGNITO
    case AWS_RESOURCE_TYPE.COGNITO.USER_POOL:
      cfResource = tempResource as CfnUserPool
      break
    case AWS_RESOURCE_TYPE.COGNITO.USER_POOL_CLIENT:
      cfResource = tempResource as CfnUserPoolClient
      break
    // EC2
    case AWS_RESOURCE_TYPE.EC2.VPC:
      cfResource = tempResource as CfnVPC
      break
    case AWS_RESOURCE_TYPE.EC2.SECURITY_GROUP:
      cfResource = tempResource as CfnSecurityGroup
      break
    case AWS_RESOURCE_TYPE.EC2.VPC_PEERING_CONNECTION:
      cfResource = tempResource as CfnVPCPeeringConnection
      break

    // BATCH
    case AWS_RESOURCE_TYPE.BATCH.JOB_QUEUE:
      cfResource = tempResource as CfnJobQueue
      break
    case AWS_RESOURCE_TYPE.BATCH.JOB_DEFINITION:
      cfResource = tempResource as CfnJobDefinition
      break
    case AWS_RESOURCE_TYPE.BATCH.COMPUTE_ENVIRONMENT:
      cfResource = tempResource as CfnComputeEnvironment
      break
    // EVENTS
    case AWS_RESOURCE_TYPE.EVENTS.RULE:
      cfResource = tempResource as CfnRule
      break
    // LOGS
    case AWS_RESOURCE_TYPE.LOGS.LOG_GROUP:
      cfResource = tempResource as CfnLogGroup
      break
    // APP SYNC
    case AWS_RESOURCE_TYPE.APP_SYNC.GRAPH_API:
      cfResource = tempResource as CfnGraphQLApi
      break
    case AWS_RESOURCE_TYPE.APP_SYNC.DATA_SOURCE:
      cfResource = tempResource as CfnDataSource
      break
    case AWS_RESOURCE_TYPE.APP_SYNC.GRAPH_SCHEMA:
      cfResource = tempResource as CfnGraphQLSchema
      break
    // ROUTE 53
    case AWS_RESOURCE_TYPE.ROUTE_53.HEALTH_CHECK:
      cfResource = tempResource as CfnHealthCheck
      break
    case AWS_RESOURCE_TYPE.ROUTE_53.RECORD_SET:
      cfResource = tempResource as CfnRecordSet
      break
    case AWS_RESOURCE_TYPE.KMS.KEY:
      cfResource = tempResource as CfnKey
      break
    default:
      throw new Error('Invalid type of resource')
  }
  // Let's this method fail during deployment so we know we missed something
  // Otherwise, put a try/catch and throw an error
  cfResource.overrideLogicalId(normalizeLogicalId(logicalId))
}

export function getNodejsFunctionOptions(scope: IConstruct, options?: NodejsFunctionProps): NodejsFunctionProps {
  return merge(
    {},
    {
      timeout: Duration.seconds(50),
      runtime: Runtime.NODEJS_16_X,
      environment: {
        REGION: Stack.of(scope).region,
        AVAILABILITY_ZONES: JSON.stringify(Stack.of(scope).availabilityZones),
      },
      bundling: {
        // minify: true,
        target: 'es2020',
        charset: Charset.UTF8,
        format: OutputFormat.CJS,
        externalModules: ['aws-sdk', '@prisma/client', 'prisma'],
      },
    },
    options ?? {},
  )
}

export function getDatabaseUrlFromSecret(secret: Secret) {
  const auroraCredentials: AuroraCredentials = {
    host: secret.secretValueFromJson('host').toString(),
    dbname: secret.secretValueFromJson('dbname').toString(),
    username: secret.secretValueFromJson('username').toString(),
    password: secret.secretValueFromJson('password').toString(),
  }
  const schema = 'public'
  const connectionLimit = 1

  // use connection_limit due to the recommendation from the prisma documentation (https://www.prisma.io/docs/guides/performance-and-optimization/connection-management#recommended-connection-pool-size)
  return `postgresql://${auroraCredentials.username}:${auroraCredentials.password}@${auroraCredentials.host}:5432/${auroraCredentials.dbname}?schema=${schema}&connection_limit=${connectionLimit}`
}

/**
 * Removes all nullish values from an array.
 *
 * @param arr Array
 * @returns Array without undefined or null
 */
export function removeNullableFromArr<T>(arr: T[]): Array<NonNullable<T>> {
  /// @ts-expect-error // typescript can not understand our filter
  return arr.filter((a) => a != null)
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function hasOwnProperty<X extends Object, Y extends PropertyKey>(
  obj: X,
  prop: Y,
): obj is X & Record<Y, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

export function normalizeLogicalId(id: string): string {
  return id.replace(/[+._-]/g, '')
}

export function wrapStringsWithQuote(inputs?: string[]) {
  if (inputs == null || inputs.length === 0) return "'*'"

  return `'${inputs.join(',')}'`
}
