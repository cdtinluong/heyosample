/* Based on https://stackoverflow.com/questions/65213615/cdk-to-enable-dns-resolution-for-vpcpeering */

import { aws_iam as iam, aws_logs as logs, custom_resources } from 'aws-cdk-lib'
import { CfnRoute, Vpc } from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'
import { normalizeLogicalId } from 'cdk/lib/utils'

export interface AllowVPCPeeringDNSResolutionProps {
  vpcPeeringId: string
  stackName: string
  region: string
  refRegion: string // reference region
  refRegionCidr: string
}

/**
 * this resource does:
 * - add to master security group rule (ingress)
 * - add to master route to current vpc (Peering route)
 * - add to region route to current vpc (Peering route)
 * - associate the subnets to route table (master & region)
 */
export class MasterPeeringConfig extends Construct {
  public constructor(scope: Construct, id: string, props: AllowVPCPeeringDNSResolutionProps) {
    super(scope, id)
    const onCreate: custom_resources.AwsSdkCall = {
      service: 'EC2',
      action: 'modifyVpcPeeringConnectionOptions',
      parameters: {
        VpcPeeringConnectionId: props.vpcPeeringId,
        AccepterPeeringConnectionOptions: {
          AllowDnsResolutionFromRemoteVpc: true,
        },
      },
      physicalResourceId: custom_resources.PhysicalResourceId.of(`allowVPCPeeringDNSResolution:${props.vpcPeeringId}`),
    }
    const onUpdate = onCreate
    const onDelete: custom_resources.AwsSdkCall = {
      service: 'EC2',
      action: 'modifyVpcPeeringConnectionOptions',
      parameters: {
        VpcPeeringConnectionId: props.vpcPeeringId,
        AccepterPeeringConnectionOptions: {
          AllowDnsResolutionFromRemoteVpc: false,
        },
      },
    }

    new custom_resources.AwsCustomResource(this, `${props.stackName}-allow-peering-dns-resolution`, {
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
    })
    const regionVpcName = `${normalizeLogicalId(`${props.stackName}-${props.region}-VPC`)}-VPC-NEW`
    // master vpc
    const regionVpc = Vpc.fromLookup(this, `${props.stackName}-master-region-vpc`, {
      vpcName: regionVpcName,
      region: props.region,
    })

    const regionSubnets = [...regionVpc.privateSubnets, ...regionVpc.publicSubnets]
    // add routes
    regionSubnets.forEach((mSubnet) => {
      // add new route
      new CfnRoute(this, `${props.stackName}-${props.refRegion}-${mSubnet.subnetId}`, {
        routeTableId: mSubnet.routeTable.routeTableId,
        vpcPeeringConnectionId: props.vpcPeeringId,
        destinationCidrBlock: props.refRegionCidr,
      })
    })
  }
}
