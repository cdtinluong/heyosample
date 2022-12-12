/* Based on https://stackoverflow.com/questions/65213615/cdk-to-enable-dns-resolution-for-vpcpeering */

import { aws_ec2 as ec2, aws_iam as iam, aws_logs as logs, custom_resources } from 'aws-cdk-lib'
import { CfnRoute, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'
import { normalizeLogicalId } from 'cdk/lib/utils'

export interface AllowVPCPeeringDNSResolutionProps {
  peeringConnection: ec2.CfnVPCPeeringConnection
  stackName: string
  region: string
  masterRegion: string
  masterVpcCidr: string
}

/**
 * this resource does:
 * - add to region route to current vpc (Peering route)
 * - associate the subnets to route table (master & region)
 */
export class PeeringConfig extends Construct {
  public constructor(scope: Construct, id: string, props: AllowVPCPeeringDNSResolutionProps) {
    super(scope, id)
    const onCreate: custom_resources.AwsSdkCall = {
      service: 'EC2',
      action: 'modifyVpcPeeringConnectionOptions',
      parameters: {
        VpcPeeringConnectionId: props.peeringConnection.ref,
        RequesterPeeringConnectionOptions: {
          AllowDnsResolutionFromRemoteVpc: true,
        },
      },
      physicalResourceId: custom_resources.PhysicalResourceId.of(
        `allowVPCPeeringDNSResolution:${props.peeringConnection.ref}`,
      ),
    }
    const onUpdate = onCreate
    const onDelete: custom_resources.AwsSdkCall = {
      service: 'EC2',
      action: 'modifyVpcPeeringConnectionOptions',
      parameters: {
        VpcPeeringConnectionId: props.peeringConnection.ref,
        RequesterPeeringConnectionOptions: {
          AllowDnsResolutionFromRemoteVpc: false,
        },
      },
    }

    const allowDnsResourceRegion = new custom_resources.AwsCustomResource(
      this,
      `${props.stackName}-allow-peering-dns-resolution`,
      {
        policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: ['ec2:ModifyVpcPeeringConnectionOptions'],
          }),
        ]),
        logRetention: logs.RetentionDays.ONE_MONTH,
        onCreate,
        onUpdate,
        onDelete,
      },
    )

    allowDnsResourceRegion.node.addDependency(props.peeringConnection)
    const regionVpcName = `${normalizeLogicalId(`${props.stackName}-${props.region}-VPC`)}-VPC-NEW`
    const regionVpc = Vpc.fromLookup(this, `${props.stackName}-region-vpc`, {
      vpcName: regionVpcName,
      region: props.region,
    })

    const regionSubnets = [...regionVpc.privateSubnets, ...regionVpc.publicSubnets]
    // add routes
    regionSubnets.forEach((mSubnet) => {
      // add new route
      new CfnRoute(this, `${props.stackName}-${props.masterRegion}-${props.region}-${mSubnet.subnetId}`, {
        routeTableId: mSubnet.routeTable.routeTableId,
        vpcPeeringConnectionId: props.peeringConnection.ref,
        destinationCidrBlock: props.masterVpcCidr,
      })
    })
  }
}
