import { App, NestedStack, Stack, StackProps } from 'aws-cdk-lib'
import { IVpc, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2'
import env from 'cdk/lib/env'
import { BaseNestedStackProps } from 'cdk/lib/stack.interface'
import { merge } from 'lodash'
import { normalizeLogicalId } from 'cdk/lib/utils'
import { MasterPeeringStack } from './peering/master-peering.stack'
import { AppSyncResourceStack } from './appsync.stack'
import { AuroraResourceStack } from './aurora.stack'
import { BatchResourceStack } from './batch.stack'
import { CognitoResourceStack } from './cognito.stack'
import { MultiRegionS3Stack } from './multi-region-s3.stack'
import { S3Stack } from './s3.stack'
import { KMSResourceStack } from './kms.stack'

interface ResourceStackProps extends StackProps {
  replicateRegions: string[]
  regionCidrMapping: Record<string, string>
}

export class ResourceStack extends Stack {
  public db: AuroraResourceStack

  public cognito: CognitoResourceStack

  public constructor(scope: App, protected id: string, private props: ResourceStackProps) {
    super(scope, id, props)

    const globalEnvironment = {
      DATABASE_URL: env.DATABASE_URL,
      STAGE: env.STAGE,
      STACK_NAME: env.STACK_NAME,
      RESOURCE_STACK_NAME: env.RESOURCE_STACK_NAME,
      MRAP_ARN: env.MRAP_ARN,
      SENTRY_DSN: env.SENTRY_DSN,
      RESOURCE_REGION: env.RESOURCE_REGION,
      CDK_ACCOUNT: env.CDK_ACCOUNT,
    }
    const stackName = props.stackName ?? env.RESOURCE_STACK_NAME

    // Instantiate the shared resources
    const multiStackProps: BaseNestedStackProps = {
      stackName,
      parentStackName: stackName,
      stage: env.STAGE,
      isProd: env.IS_PROD,
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    }

    const baseVpcStackName = normalizeLogicalId(`${env.CROSS_REGION_STACK_NAME}-${this.region}-VPC`)
    // master vpc that created from cross region
    const vpc = this.getVpc(baseVpcStackName)
    const securityGroup = this.getSecurityGroup(baseVpcStackName, vpc)

    // Create the DB
    const dbName = 'Aurora'
    this.db = new AuroraResourceStack(this, dbName, {
      ...multiStackProps,
      stackName: dbName,
      vpc,
      securityGroup,
    })
    this.overrideLogicalId(this.db, dbName)

    // Create KMS Key
    const kmsKeyName = 'KmsKey'
    const kmsKey = new KMSResourceStack(this, kmsKeyName, {
      ...multiStackProps,
      stackName: kmsKeyName,
      vpc,
      securityGroup,
      environment: {},
    })
    this.overrideLogicalId(kmsKey, kmsKeyName)

    // Create the cognito user pool
    const cognitoName = 'Cognito'
    this.cognito = new CognitoResourceStack(this, cognitoName, {
      ...multiStackProps,
      vpc,
      securityGroup,
      stackName: cognitoName,
      environment: {
        KMS_KEY_ARN: kmsKey.getKey().keyArn,
        KMS_KEY_ALIAS: kmsKey.getKeyAlias(),
        RESOURCE_REGION: env.RESOURCE_REGION,
        AMPLITUDE_API_KEY: env.AMPLITUDE_API_KEY,
        AMPLITUDE_BASE_URL: env.AMPLITUDE_BASE_URL,
      },
    })
    this.overrideLogicalId(this.cognito, cognitoName)
    this.cognito.addDependency(kmsKey)

    const { userPoolId } = this.cognito.getCognito().userPool

    // MRAP
    const mrapName = 'MultiRegionS3'
    const mrap = new MultiRegionS3Stack(this, mrapName, {
      ...multiStackProps,
      stackName: mrapName,
      replicationRegions: env.REPLICATION_REGIONS,
      environment: globalEnvironment,
    })
    this.overrideLogicalId(mrap, mrapName)

    // Batch CRON
    const batchName = 'Batch'
    const batch = new BatchResourceStack(this, batchName, {
      ...multiStackProps,
      stackName: batchName,
      environment: merge(globalEnvironment, {
        USER_POOL_ID: userPoolId,
        MRAP_ARN: mrap.getMRAPArn(),
        SECRET_ID: this.db.getSecret().secretName,
        DB_PROXY_NAME: this.db.getDbProxyName(),
        BRAZE_API_KEY: env.BRAZE_API_KEY,
        BRAZE_REST_ENDPOINT: env.BRAZE_REST_ENDPOINT,
        BRAZE_APP_ID: env.BRAZE_APP_ID,
        BRAZE_SENDER_EMAIL: env.BRAZE_SENDER_EMAIL,
      }),
      vpc,
      securityGroup,
    })
    this.overrideLogicalId(batch, batchName)
    batch.addDependency(this.db)
    batch.addDependency(mrap)

    // Appsync stack
    const appSyncName = 'AppSync'
    const appsync = new AppSyncResourceStack(this, appSyncName, {
      ...multiStackProps,
      stackName: appSyncName,
      environment: merge(globalEnvironment, { USER_POOL_ID: userPoolId }),
    })
    this.overrideLogicalId(appsync, appSyncName)

    // S3 buckets
    const s3Name = 'S3'
    const s3 = new S3Stack(this, s3Name, {
      ...multiStackProps,
      stackName: s3Name,
      environment: {},
    })
    this.overrideLogicalId(s3, s3Name)

    // add master peering
    new MasterPeeringStack(this, `${stackName}-Peering`, {
      parentStackName: env.CROSS_REGION_STACK_NAME,
      replicateRegions: props.replicateRegions,
      regionCidrMapping: props.regionCidrMapping,
      vpc,
    })
  }

  private getVpc(baseVpcStack: string) {
    const vpcName = `${baseVpcStack}-VPC-NEW`
    return Vpc.fromLookup(this, vpcName, {
      vpcName,
      region: this.region,
    })
  }

  private getSecurityGroup(baseVpcStack: string, vpc: IVpc) {
    const sgName = `${baseVpcStack}-SG-NEW`
    return SecurityGroup.fromLookupByName(this, sgName, sgName, vpc)
  }

  private overrideLogicalId(stack: NestedStack, id: string): void {
    stack.nestedStackResource?.overrideLogicalId(id)
  }
}
