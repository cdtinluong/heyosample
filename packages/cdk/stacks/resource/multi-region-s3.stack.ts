import { NestedStack } from 'aws-cdk-lib'
import { CfnMultiRegionAccessPoint } from 'aws-cdk-lib/aws-s3'
import env from 'cdk/lib/env'
import { MultiRegionS3StackProps } from 'cdk/lib/stack.interface'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'
import { Construct } from 'constructs'

export class MultiRegionS3Stack extends NestedStack {
  private multiRegionAccessPoint: CfnMultiRegionAccessPoint

  public constructor(scope: Construct, id: string, protected props: MultiRegionS3StackProps) {
    super(scope, id, props)

    const multiRegionAccessPointName = `${props.parentStackName}-MultiRegionAccessPoint`
    this.multiRegionAccessPoint = new CfnMultiRegionAccessPoint(this, 'S3MultiRegionAccessPoint', {
      name: multiRegionAccessPointName.toLowerCase(),
      regions: props.replicationRegions.map((region) => ({
        bucket: `${env.S3_BUCKET_NAME}-${region}`,
      })),
    })

    overrideLogicalId(
      this.multiRegionAccessPoint,
      AWS_RESOURCE_TYPE.S3.MULTI_REGION_ACCESS_POINT,
      multiRegionAccessPointName,
    )
  }

  public getMRAPArn() {
    const accountId = this.props.environment?.CDK_ACCOUNT ?? '522227034001'
    return `arn:aws:s3::${accountId}:accesspoint/${this.multiRegionAccessPoint.attrAlias}`
  }
}
