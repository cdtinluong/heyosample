import { NestedStack, NestedStackProps } from 'aws-cdk-lib'
import { CfnVPCPeeringConnection, Vpc } from 'aws-cdk-lib/aws-ec2'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { AWS_RESOURCE_TYPE, normalizeLogicalId, overrideLogicalId } from 'cdk/lib/utils'
import env from 'cdk/lib/env'

import { PeeringConfig } from './peering-config'

interface IPeeringStacks extends NestedStackProps {
  masterRegion: string
  vpcId: string // region vpc id (replicate)
  parentStackName: string
  masterCidr: string
}

export class ReplicatePeeringStack extends NestedStack {
  public constructor(scope: Construct, id: string, props: IPeeringStacks) {
    super(scope, id, props)
    const resourceGroupName = normalizeLogicalId(`${props.parentStackName}-${props.masterRegion}-VPC`)
    // get master vpc
    const masterVpcName = `${resourceGroupName}-VPC-NEW`
    const masterVpc = Vpc.fromLookup(this, masterVpcName, {
      vpcName: masterVpcName,
      region: props.masterRegion,
    })
    //
    // create peering connection
    const peeringName = `pcx-${masterVpcName}-${this.region}` // the name should be pxc-*
    const peering = new CfnVPCPeeringConnection(this, peeringName, {
      vpcId: props.vpcId,
      peerVpcId: masterVpc.vpcId, // accepter vpc
      peerOwnerId: this.account, // accepter account id
      peerRegion: props.masterRegion, // accepter region
      tags: [
        {
          key: 'name',
          value: `${this.region}-${props.masterRegion}-peering`,
        },
      ],
    })
    overrideLogicalId(peering, AWS_RESOURCE_TYPE.EC2.VPC_PEERING_CONNECTION, peeringName)

    const peeringConfigName = `${resourceGroupName}-peering-config`
    // config DNS and routing
    new PeeringConfig(this, peeringConfigName, {
      masterRegion: props.masterRegion,
      region: this.region,
      peeringConnection: peering,
      stackName: props.parentStackName,
      masterVpcCidr: props.masterCidr,
    })
    // store peering id to SSM
    const peeringSSMName = `${env.STACK_NAME}-PeeringIdSSMParam${props.masterRegion}-${this.region}`
    new StringParameter(this, `${props.parentStackName}-peeringSSMName`, {
      parameterName: normalizeLogicalId(peeringSSMName),
      description: 'Peering id',
      stringValue: peering.ref,
    })
  }
}
