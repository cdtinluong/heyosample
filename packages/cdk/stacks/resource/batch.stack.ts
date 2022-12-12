import { NestedStack } from 'aws-cdk-lib'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { BatchJob } from 'aws-cdk-lib/aws-events-targets'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { CfnJobDefinition, CfnComputeEnvironment, CfnJobQueue } from 'aws-cdk-lib/aws-batch'
import { Role, CompositePrincipal, ServicePrincipal, ManagedPolicy, CfnInstanceProfile } from 'aws-cdk-lib/aws-iam'
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets'
import { BaseNestedStackProps } from 'cdk/lib/stack.interface'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'
import { Construct } from 'constructs'
import * as path from 'path'
import { ISecurityGroup } from 'aws-cdk-lib/aws-ec2'

interface BatchResourceProps extends BaseNestedStackProps {
  securityGroup: ISecurityGroup
}

export class BatchResourceStack extends NestedStack {
  public constructor(protected scope: Construct, id: string, protected props: BatchResourceProps) {
    super(scope, id, props)

    // Create Batch Job for user deletion
    this.batchUserDeletion()
  }

  private batchUserDeletion(): void {
    if (this.props.vpc == null) throw new Error('Got nullish vpc for batch job, must be set')
    const ec2Type = 'm5.2xlarge'

    // Create Docker Image Asset
    const docketImageAsset = new DockerImageAsset(this, 'UserDeletionDockerImage', {
      directory: path.join(__dirname, './scripts/user_deletion'),
    })
    // Create Job Definition
    const jobDefinitionName = `${this.props.parentStackName}-JD-UserDeletion`
    const jobDefinition = new CfnJobDefinition(this, 'UserDeletionJobDefinition', {
      jobDefinitionName,
      type: 'container',
      retryStrategy: {
        attempts: 1,
      },
      containerProperties: {
        image: docketImageAsset.imageUri,
        resourceRequirements: [
          {
            type: 'VCPU',
            value: '7', // Must match the ec2Type declared above
          },
          {
            type: 'MEMORY',
            value: '512',
          },
        ],
        environment: [
          {
            name: 'MRAP_ARN',
            value: this.props.environment?.MRAP_ARN,
          },
          {
            name: 'USER_POOL_ID',
            value: this.props.environment?.USER_POOL_ID,
          },
          {
            name: 'RESOURCE_REGION',
            value: this.props.environment?.RESOURCE_REGION,
          },
          {
            name: 'SECRET_ID',
            value: this.props.environment?.SECRET_ID,
          },
          {
            name: 'DB_PROXY_NAME',
            value: this.props.environment?.DB_PROXY_NAME,
          },
          {
            name: 'BRAZE_API_KEY',
            value: this.props.environment?.BRAZE_API_KEY,
          },
          {
            name: 'BRAZE_REST_ENDPOINT',
            value: this.props.environment?.BRAZE_REST_ENDPOINT,
          },
          {
            name: 'BRAZE_APP_ID',
            value: this.props.environment?.BRAZE_APP_ID,
          },
          {
            name: 'BRAZE_SENDER_EMAIL',
            value: this.props.environment?.BRAZE_SENDER_EMAIL,
          },
        ],
      },
    })
    overrideLogicalId(jobDefinition, AWS_RESOURCE_TYPE.BATCH.JOB_DEFINITION, jobDefinitionName)

    // Create Role for EC2 instance
    const instanceRoleName = `${this.props.parentStackName}-BatchRole-UserDeletion`
    const instanceRole = new Role(this, 'UserDeletionRole', {
      roleName: instanceRoleName,
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('ec2.amazonaws.com'),
        new ServicePrincipal('ecs.amazonaws.com'),
        new ServicePrincipal('ecs-tasks.amazonaws.com'),
      ),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
      ],
    })
    overrideLogicalId(instanceRole, AWS_RESOURCE_TYPE.IAM.ROLE, instanceRoleName)

    // Create Instance Profile for EC2 Instance
    const instanceProfileName = `${this.props.parentStackName}-IP-UserDeletion`
    const instanceProfile = new CfnInstanceProfile(this, 'UserDeletionInstanceProfile', {
      instanceProfileName,
      roles: [instanceRoleName],
    })
    overrideLogicalId(instanceProfile, AWS_RESOURCE_TYPE.IAM.INSTANCE_PROFILE, instanceProfileName)

    // Create Compute Environment
    const computeEnvName = `${this.props.parentStackName}-CE-UserDeletion`
    const computeEnv = new CfnComputeEnvironment(this, 'UserDeletionComputeEnv', {
      computeEnvironmentName: computeEnvName,
      type: 'MANAGED',
      computeResources: {
        type: 'EC2',
        minvCpus: 0,
        desiredvCpus: 0,
        maxvCpus: 64,
        instanceRole: instanceProfile.attrArn,
        securityGroupIds: [this.props.securityGroup.securityGroupId],
        subnets: [this.props.vpc.privateSubnets[0].subnetId],
        instanceTypes: [ec2Type],
      },
    })
    overrideLogicalId(computeEnv, AWS_RESOURCE_TYPE.BATCH.COMPUTE_ENVIRONMENT, computeEnvName)

    // Create Job Queue
    const jobQueueName = `${this.props.parentStackName}-JQ-UserDeletion`
    const jobQueue = new CfnJobQueue(this, 'UserDeletionJobQueue', {
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [
        {
          computeEnvironment: computeEnv.attrComputeEnvironmentArn,
          order: 1,
        },
      ],
    })
    overrideLogicalId(jobQueue, AWS_RESOURCE_TYPE.BATCH.JOB_QUEUE, jobQueueName)

    // Create DLQ
    const queueName = `${this.props.parentStackName}-BatchQueue-UserDeletion`
    const queue = new Queue(this, 'UserDeletionQueue', {
      queueName,
    })
    overrideLogicalId(queue, AWS_RESOURCE_TYPE.SQS.QUEUE, queueName)

    // Create Schedule Rule
    const ruleName = `${this.props.parentStackName}-BatchRule-UserDeletion`
    const rule = new Rule(this, 'UserDeletionRule', {
      ruleName,
      description: 'Rule who launch the user deletion daily at 03:00 (GMT)',
      schedule: Schedule.cron({ hour: '3', minute: '0' }),
      targets: [
        new BatchJob(jobQueue.ref, jobQueue, jobDefinition.ref, jobDefinition, {
          deadLetterQueue: queue,
          jobName: `${this.props.parentStackName}-UserDeletion`,
        }),
      ],
    })
    overrideLogicalId(rule, AWS_RESOURCE_TYPE.EVENTS.RULE, ruleName)
  }
}
