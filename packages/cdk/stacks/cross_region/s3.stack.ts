import { NestedStack, RemovalPolicy, Duration } from 'aws-cdk-lib'
import { AnyPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership, CfnBucket } from 'aws-cdk-lib/aws-s3'
import env from 'cdk/lib/env'
import { NestedCrossRegionProps } from 'cdk/lib/stack.interface'
import { AWS_RESOURCE_TYPE, normalizeLogicalId, overrideLogicalId } from 'cdk/lib/utils'
import { Construct } from 'constructs'

export class S3Stack extends NestedStack {
  public constructor(scope: Construct, id: string, protected props: NestedCrossRegionProps) {
    super(scope, id, props)

    const replicationRegions = env.REPLICATION_REGIONS
    const bucketName = `${env.S3_BUCKET_NAME.toLowerCase()}-${props.region}`
    const baseBucketName = env.S3_BUCKET_NAME.toLowerCase()
    const removalPolicy = this.props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY

    const bucket = new Bucket(this, normalizeLogicalId(bucketName), {
      bucketName,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy,
      lifecycleRules: [
        {
          id: `${bucketName}-lifecycle`,
          enabled: true,
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          noncurrentVersionsToRetain: 5,
        },
      ],
    })
    overrideLogicalId(bucket, AWS_RESOURCE_TYPE.S3.BUCKET, bucketName)

    bucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        resources: [bucket.bucketArn],
        actions: ['s3:DeleteBucket'],
        principals: [new AnyPrincipal()],
      }),
    )

    if (props.initialDeploy !== 'true') {
      const roleName = `${props.parentStackName}-ReplicationRole-${props.region}`
      const role = new Role(this, 'S3MultiRegionReplicationRole', {
        assumedBy: new ServicePrincipal('s3.amazonaws.com'),
        path: '/service-role/',
        roleName,
      })
      overrideLogicalId(role, AWS_RESOURCE_TYPE.IAM.ROLE, roleName)

      role.addToPolicy(
        new PolicyStatement({
          resources: replicationRegions.map((region) => `arn:aws:s3:::${baseBucketName}-${region}`),
          actions: [
            's3:GetReplicationConfiguration',
            's3:ListBucket',
            's3:List*',
            's3:GetBucketVersioning',
            's3:PutBucketVersioning',
          ],
        }),
      )

      role.addToPolicy(
        new PolicyStatement({
          resources: replicationRegions.map((region) => `arn:aws:s3:::${baseBucketName}-${region}/*`),
          actions: [
            's3:GetObjectVersion',
            's3:GetObjectVersionAcl',
            's3:GetObjectVersionForReplication',
            's3:GetObjectVersionTagging',
            's3:ReplicateDelete',
            's3:ReplicateObject',
            's3:ReplicateTags',
          ],
        }),
      )

      const cfnBucket = bucket.node.defaultChild as CfnBucket
      cfnBucket.replicationConfiguration = {
        role: role.roleArn,
        rules: replicationRegions
          .filter((region) => region !== props.region)
          .map((region, index) => ({
            id: region,
            destination: {
              bucket: `arn:aws:s3:::${baseBucketName}-${region}`,
            },
            priority: index,
            deleteMarkerReplication: {
              status: 'Enabled',
            },
            filter: {
              prefix: '',
            },
            VersioningConfiguration: {
              status: 'Enabled',
            },
            status: 'Enabled',
          })),
      }
    }
  }
}
