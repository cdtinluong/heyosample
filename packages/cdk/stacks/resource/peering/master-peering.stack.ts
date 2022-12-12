import { NestedStack, NestedStackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { ISecurityGroup, IVpc, Peer, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2'
import { normalizeLogicalId } from 'cdk/lib/utils'
import { SSMParameterReader } from 'cdk/lib/ssm-parameter-reader'
import env from 'cdk/lib/env'

import { MasterPeeringConfig } from './master-peering-config'

interface IPeeringStacks extends NestedStackProps {
  parentStackName: string
  vpc: IVpc // master vpc
  replicateRegions: string[]
  regionCidrMapping: Record<string, string>
}

export class MasterPeeringStack extends NestedStack {
  public constructor(scope: Construct, id: string, private props: IPeeringStacks) {
    super(scope, id, props)
    const masterResourceGroupName = normalizeLogicalId(`${props.parentStackName}-${this.region}-VPC`)
    // add security group rule
    const masterSecurityGroup = SecurityGroup.fromLookupByName(
      this,
      `${masterResourceGroupName}-sg`,
      `${masterResourceGroupName}-SG-NEW`,
      props.vpc,
    )

    // config peering connection (enable dns, add routing)
    props.replicateRegions.forEach((region) => this.configPeering(region, masterSecurityGroup))
  }

  private configPeering(region: string, masterSecurityGroup: ISecurityGroup) {
    const regionGroupName = normalizeLogicalId(`${this.props.parentStackName}-${region}-VPC`)
    const regionVpc = Vpc.fromLookup(this, `${regionGroupName}-region-vpc`, {
      vpcName: `${regionGroupName}-VPC-NEW`,
      region,
    })
    const peeringConfigName = `${this.props.parentStackName}-${region}-peering-config`
    const peeringSSMName = `${env.STACK_NAME}-PeeringIdSSMParam${this.region}-${region}`
    const peeringIdReader = new SSMParameterReader(this, `${this.props.parentStackName}-${region}-PeeringIdReader`, {
      region, // read from replicate region
      parameterName: normalizeLogicalId(peeringSSMName),
    })
    // do extra config such as dns, routing
    new MasterPeeringConfig(this, peeringConfigName, {
      refRegion: region,
      region: this.region,
      vpcPeeringId: peeringIdReader.getParameterValue(),
      stackName: this.props.parentStackName,
      refRegionCidr: this.props.regionCidrMapping[region],
    })

    masterSecurityGroup.addIngressRule(
      Peer.ipv4(regionVpc.vpcCidrBlock),
      Port.tcp(5432),
      `Allow ${regionVpc.vpcCidrBlock} to connect`,
    )
  }
}
