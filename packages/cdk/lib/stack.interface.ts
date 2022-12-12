import { NestedStackProps, StackProps } from 'aws-cdk-lib'
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito'
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface AuroraCredentials {
  host: string
  dbname: string
  password: string
  username: string
}

export interface ResourceStackProps {
  secret: Secret
  cognito: {
    userPool: UserPool
    userPoolName: string
    userPoolClient: UserPoolClient
  }
}

export interface AppStackProps extends StackProps {
  resources: ResourceStackProps
}

export interface BaseNestedStackProps extends NestedStackProps {
  stackName: string
  region: string
  parentStackName: string
  stage: string
  isProd: boolean
  account: string
  environment?: {
    [key: string]: string
  }
  vpc?: IVpc
  securityGroup?: ISecurityGroup
}

export interface MultiStackProps extends NestedStackProps {
  stackName: string
  region: string
  account: string
  globalEnvironment: {
    [key: string]: string
  }
  resources: ResourceStackProps
  isProd: boolean
}

export type DBMultiStackProps = BaseNestedStackProps & {
  securityGroup: ISecurityGroup
}
export interface MultiRegionS3StackProps extends BaseNestedStackProps {
  account: string
  replicationRegions: string[]
}

export interface CrossRegionProps extends StackProps {
  initialDeploy: string
  vpcCidr: string
  masterVpcCidr: string
  masterRegion: string
}

export interface NestedCrossRegionProps extends BaseNestedStackProps {
  initialDeploy: string
}
