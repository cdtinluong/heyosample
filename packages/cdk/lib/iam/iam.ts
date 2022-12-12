import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'

export function createPolicy(scope: Construct, name: string, statements: PolicyStatement[]): Policy {
  const policy = new Policy(scope, name, { statements, force: true })
  overrideLogicalId(policy, AWS_RESOURCE_TYPE.IAM.POLICY, name)
  return policy
}

export function createPolicyStatement(actions: string[], resources: string[]): PolicyStatement {
  return new PolicyStatement({ actions, resources, effect: Effect.ALLOW })
}

export function createS3PolicyStatement(actions: string[], bucketsName: string[]): PolicyStatement {
  const resources: string[] = []
  bucketsName.forEach((bucketName: string) => {
    resources.push(`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`)
  })
  return new PolicyStatement({ actions, resources, effect: Effect.ALLOW })
}
