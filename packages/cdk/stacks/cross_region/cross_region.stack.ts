import { App, NestedStack, Stack } from 'aws-cdk-lib'
import env from 'cdk/lib/env'
import { BaseNestedStackProps, CrossRegionProps } from 'cdk/lib/stack.interface'
import { normalizeLogicalId } from 'cdk/lib/utils'
import { ReplicatePeeringStack } from './peering/peering.stack'
import { S3Stack } from './s3.stack'
import { VPCStack } from './vpc.stack'

export class CrossRegionStack extends Stack {
  public constructor(scope: App, protected id: string, private props: CrossRegionProps) {
    super(scope, id, props)
    // EG: LC-DEV-CrossRegion
    const stackName = props.stackName ?? env.CROSS_REGION_STACK_NAME

    // Instantiate the shared resources
    const multiStackProps: BaseNestedStackProps = {
      stackName,
      parentStackName: stackName,
      stage: env.STAGE,
      isProd: env.IS_PROD,
      account: Stack.of(this).account,
      region: Stack.of(this).region,
    }

    // s3 buckets
    const s3Name = 'S3'
    const s3 = new S3Stack(this, s3Name, {
      ...multiStackProps,
      stackName: s3Name,
      initialDeploy: props.initialDeploy,
    })
    this.overrideLogicalId(s3, s3Name)

    // VPC
    // VPC requires NAT Gateways which has a fix cost of 170$ per month so up to 510$ per month
    // It's currently not necessary during the development time, we'll have to improve this later on
    const vpcStackName = normalizeLogicalId(`${stackName}-${this.region}-VPC`)
    const vpcStack = new VPCStack(this, vpcStackName, {
      ...multiStackProps,
      stackName: vpcStackName,
      cidr: props.vpcCidr,
    })
    this.overrideLogicalId(vpcStack, vpcStackName)
    // only create peering if not master region
    if (props.masterRegion !== this.region && props.initialDeploy !== 'true') {
      // add peering connection
      const peeringStack = new ReplicatePeeringStack(this, `${stackName}-${this.region}-Peering`, {
        masterRegion: props.masterRegion,
        vpcId: vpcStack.getVpc().vpcId,
        parentStackName: env.CROSS_REGION_STACK_NAME,
        masterCidr: props.masterVpcCidr,
      })
      peeringStack.addDependency(vpcStack)
    }
  }

  private overrideLogicalId(stack: NestedStack, id: string): void {
    stack.nestedStackResource?.overrideLogicalId(id)
  }
}
