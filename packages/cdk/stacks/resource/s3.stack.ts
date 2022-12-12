import { NestedStack } from 'aws-cdk-lib'
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'
import { BaseNestedStackProps } from 'cdk/lib/stack.interface'
import { Construct } from 'constructs'

export class S3Stack extends NestedStack {
  public constructor(scope: Construct, id: string, protected props: BaseNestedStackProps) {
    super(scope, id, props)

    // Create the bucket to hold the openapi file
    const bucketName = `${props.parentStackName}-openapi`.toLowerCase()
    const bucket = new Bucket(this, bucketName, {
      bucketName,
      publicReadAccess: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })
    overrideLogicalId(bucket, AWS_RESOURCE_TYPE.S3.BUCKET, bucketName)
  }
}
