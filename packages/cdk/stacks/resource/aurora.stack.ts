import { Duration, NestedStack, RemovalPolicy } from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { InstanceClass, InstanceSize, InstanceType, SubnetType } from 'aws-cdk-lib/aws-ec2'
import {
  AuroraPostgresEngineVersion,
  CfnDBProxyEndpoint,
  DatabaseCluster,
  DatabaseClusterEngine,
  DatabaseProxy,
  ParameterGroup,
  ProxyTarget,
  SubnetGroup,
} from 'aws-cdk-lib/aws-rds'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { DBMultiStackProps } from 'cdk/lib/stack.interface'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'
import { Construct } from 'constructs'

const instanceTypeMap: { [key: string]: InstanceType } = {
  dev: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MEDIUM),
  stg: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MEDIUM),
  prod: InstanceType.of(InstanceClass.MEMORY6_GRAVITON, InstanceSize.LARGE),
}

const getInstanceType = (stage: string): InstanceType => instanceTypeMap[stage] ?? instanceTypeMap.dev

export class AuroraResourceStack extends NestedStack {
  private secret: Secret

  private dbProxyName: string

  public constructor(scope: Construct, id: string, private props: DBMultiStackProps) {
    super(scope, id, props)
    this.dbProxyName = `${this.props.parentStackName}-DBProxy`
    if (this.props.vpc == null) throw new Error('Got nullish vpc for aurora stack')
    const dbSubnets = this.props.vpc.selectSubnets({
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
    })

    // Create new subnet group for RDS
    const subnetGroupName = `${props.parentStackName}-subnetgroup`
    const subnetGroup = new SubnetGroup(this, subnetGroupName, {
      vpc: this.props.vpc,
      description: 'Subnet group for RDS',
      vpcSubnets: dbSubnets,
    })

    // DB information
    const secretName = `${props.parentStackName}-db-cluster`
    const engine = DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_13_6 })
    const auroraClusterName = `${props.parentStackName}-cluster`
    const auroraCluster = new DatabaseCluster(this, 'DBCluster', {
      engine,
      backup: {
        retention: Duration.days(7),
        preferredWindow: '00:00-01:00',
      },
      clusterIdentifier: auroraClusterName,
      instanceProps: {
        // db only need to access from private subnet
        vpcSubnets: dbSubnets,
        vpc: this.props.vpc,
        parameterGroup: new ParameterGroup(this, `${props.parentStackName}-InstanceParameterGroup`, {
          engine,
          description: `${props.parentStackName}'s Instance Parameter Group`,
          parameters: {
            shared_preload_libraries: 'pglogical',
          },
        }),
        instanceType: getInstanceType(props.stage),
        securityGroups: [this.props.securityGroup],
        enablePerformanceInsights: true, // Retention set to 7 days by default
      },
      parameterGroup: new ParameterGroup(this, `${props.parentStackName}-ClusterParameterGroup`, {
        engine,
        description: `${props.parentStackName}'s Cluster Parameter Group`,
        parameters: {
          shared_preload_libraries: 'pglogical',
          'rds.logical_replication': '1',
        },
      }),
      // eslint-disable-next-line no-useless-escape
      defaultDatabaseName: props.parentStackName.replace(/[-\._\+]/g, '_').toLowerCase(),
      removalPolicy: RemovalPolicy.RETAIN,
      credentials: {
        username: 'postgres',
        secretName,
      },
      cloudwatchLogsRetention: RetentionDays.ONE_MONTH,
      subnetGroup,
    })

    const dbProxy = new DatabaseProxy(this, this.dbProxyName, {
      proxyTarget: ProxyTarget.fromCluster(auroraCluster),
      dbProxyName: this.dbProxyName,
      secrets: [auroraCluster.secret as Secret],
      vpc: this.props.vpc,
      requireTLS: false,
      securityGroups: [this.props.securityGroup],
      vpcSubnets: dbSubnets,
    })
    overrideLogicalId(auroraCluster, AWS_RESOURCE_TYPE.RDS.DB_CLUSTER, auroraClusterName)

    // add readonly replicate
    const readOnlyProxyEndpoint = `${props.parentStackName}-DBProxy-RO-endpoint`
    const roProxyEndpoint = new CfnDBProxyEndpoint(this, readOnlyProxyEndpoint, {
      targetRole: 'READ_ONLY',
      vpcSecurityGroupIds: [this.props.securityGroup.securityGroupId],
      vpcSubnetIds: dbSubnets.subnetIds,
      dbProxyName: dbProxy.dbProxyName,
      dbProxyEndpointName: readOnlyProxyEndpoint,
    })
    overrideLogicalId(roProxyEndpoint, AWS_RESOURCE_TYPE.RDS.DB_PROXY_ENDPOINT, readOnlyProxyEndpoint)

    // Retrieve the secret created in credentials
    // It avoids cyclic references and is easier than creating the DatabaseSecret manually
    this.secret = Secret.fromSecretNameV2(this, `${props.parentStackName}-RetrieveSecret`, secretName) as Secret

    const { defaultPort } = auroraCluster.connections
    if (defaultPort) {
      auroraCluster.connections.allowFromAnyIpv4(defaultPort)
    }
  }

  public getSecret(): Secret {
    return this.secret
  }

  public getDbProxyName(): string {
    return this.dbProxyName
  }
}
