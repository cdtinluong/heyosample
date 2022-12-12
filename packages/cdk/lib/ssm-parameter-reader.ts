// reference: https://stackoverflow.com/questions/71246435/how-to-read-parameter-store-from-a-different-region-in-cdk
import { Construct } from 'constructs'
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources'
import { aws_iam as iam } from 'aws-cdk-lib'

interface SSMParameterReaderProps {
  parameterName: string
  region: string
}

export class SSMParameterReader extends AwsCustomResource {
  public constructor(scope: Construct, name: string, props: SSMParameterReaderProps) {
    const { parameterName, region } = props

    const ssmAwsSdkCall: AwsSdkCall = {
      service: 'SSM',
      action: 'getParameter',
      parameters: {
        Name: parameterName,
      },
      region,
      physicalResourceId: PhysicalResourceId.of(Date.now().toString()), // Update physical id to always fetch the latest version
    }

    super(scope, name, {
      onUpdate: ssmAwsSdkCall,
      policy: AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ['*'],
          actions: ['ssm:GetParameter'],
        }),
      ]),
    })
  }

  public getParameterValue(): string {
    return this.getResponseField('Parameter.Value').toString()
  }
}
