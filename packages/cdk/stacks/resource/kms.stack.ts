import { NestedStack, RemovalPolicy } from 'aws-cdk-lib'
import { Key } from 'aws-cdk-lib/aws-kms'
import { Construct } from 'constructs'
import { BaseNestedStackProps } from '../../lib/stack.interface'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from '../../lib/utils'

export class KMSResourceStack extends NestedStack {
  private key: Key

  private keyAlias: string

  public constructor(scope: Construct, id: string, protected props: BaseNestedStackProps) {
    super(scope, id, props)

    const removalPolicy = props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    const keyName = `${this.props.parentStackName}-cognitoEmailSymmetricKey`
    this.keyAlias = `alias/${keyName}`
    this.key = new Key(this, keyName, {
      removalPolicy,
      alias: this.keyAlias,
      description: 'KMS key for encrypting the cognito temp password, code',
      enableKeyRotation: false,
    })
    overrideLogicalId(this.key, AWS_RESOURCE_TYPE.KMS.KEY, keyName)
  }

  public getKey() {
    return this.key
  }

  public getKeyAlias() {
    return this.keyAlias
  }
}
