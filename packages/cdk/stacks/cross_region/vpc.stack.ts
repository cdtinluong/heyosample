import { Construct } from 'constructs'
import { NestedStack } from 'aws-cdk-lib'
import { IpAddresses, IVpc, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import { BaseNestedStackProps } from 'cdk/lib/stack.interface'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'

interface VpcStackProps extends BaseNestedStackProps {
  cidr: string
}

export class VPCStack extends NestedStack {
  private vpc: IVpc

  public constructor(scope: Construct, id: string, protected props: VpcStackProps) {
    super(scope, id, props)

    this.createNewRegionVpc()
  }

  public getVpc() {
    return this.vpc
  }

  private createNewRegionVpc() {
    // eg: eu-west-1-LC-DEV-CrossRegion-VPC-VPC
    const vpcName = `${this.props.stackName}-VPC-NEW`
    this.vpc = new Vpc(this, vpcName, {
      ipAddresses: IpAddresses.cidr(this.props.cidr),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      vpcName,
      natGateways: 1, // only 1 NAT network for each VPC
      subnetConfiguration: [
        {
          cidrMask: 20, // (2^(32 - 20) - 2) 4094 addresses per AZ
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 18, // (2^(32 - 18) - 2) 16382 addresses per AZ
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS, // private subnet
        },
      ],
    })
    overrideLogicalId(this.vpc, AWS_RESOURCE_TYPE.EC2.VPC, vpcName)

    const securityGroupName = `${this.props.stackName}-SG-NEW`
    const securityGroup = new SecurityGroup(this, securityGroupName, {
      securityGroupName,
      vpc: this.vpc,
    })
    // allow any in current security group to connect to rds (only apply for master region)
    securityGroup.addIngressRule(securityGroup, Port.tcp(5432), 'Allow rsd inside security group')
    // need this to get secrets manager or we can use the service endpoint
    securityGroup.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow outbound internet')

    overrideLogicalId(securityGroup, AWS_RESOURCE_TYPE.EC2.SECURITY_GROUP, securityGroupName)
  }
}
