import { Fn, Stack, NestedStackProps } from 'aws-cdk-lib'
import { DomainName, SpecRestApi } from 'aws-cdk-lib/aws-apigateway'
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2'
import { LayerVersion } from 'aws-cdk-lib/aws-lambda'
import { ARecord, CfnHealthCheck, CfnRecordSet, HostedZone, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets'
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager'
import { GenericSpecApiGateway } from 'cdk/lib/apigateway/generic'
import { overrideLogicalId, AWS_RESOURCE_TYPE } from 'cdk/lib/utils'
import env from 'cdk/lib/env'
import * as path from 'path'
import { CorsOption } from './interface'

// eslint-disable-next-line no-shadow
export enum ApiNames {
  'lincloud' = 'lincloud',
}

export interface LambdaStackOptions extends NestedStackProps {
  apis?: APIGateway['api']
  layers?: LayerVersion[]
  stackName: string
  region: string
  account: string
  apiPathPrefix?: string
  environment: {
    [key: string]: string
  }
  vpc?: IVpc // lambda function vpc
  securityGroup?: ISecurityGroup
  cors?: CorsOption
}

// TODO: make initializeApis run in parallel
export class APIGateway {
  public api: { [k in ApiNames]?: GenericSpecApiGateway } = {}

  private domain: DomainName | undefined

  private hostedZone: IHostedZone

  private certificate: DnsValidatedCertificate

  // eslint-disable-next-line no-useless-constructor
  public constructor(private scope: Stack, private id: string, private props: LambdaStackOptions) {
    // Configure the domain with Hosted Zone, DNS and certificates
    this.configureDomain(env.HOSTED_ZONE_ID)
  }

  public async initializeApis() {
    this.api.lincloud = await GenericSpecApiGateway.initialize(
      this.scope,
      this.props.stackName,
      'lincloud',
      path.join(__dirname, '../../../../docs/lincloud.yml'),
      '',
      this.props,
    )
  }

  public finalizeApis(userPoolARNs: string[]): void {
    Object.values(this.api).forEach((api) => {
      if (api === undefined) return
      // Set cognito as the authorizer
      api.setCognitoAuthorizer(userPoolARNs)
      // Finalize the API
      const apiObj = api.finalize()
      if (this.domain) {
        // Map the API to the custom domain name
        this.domain.addBasePathMapping(apiObj, { basePath: api.baseName })
        // Create the health check and DNS record for single entrypoint
        this.finalizeDomain(apiObj)
      }
    })
  }

  private configureDomain(hostedZoneId: string): void {
    // If it's a custom deployment we don't touch the domain or DNS
    if (['LC-DEV', 'LC-STG', 'LC-PRD'].includes(this.props.stackName) === false) return

    // Check we've everything ready to work with
    if (hostedZoneId === '') {
      throw new Error('HOSTED_ZONE_ID is mandatory when deploying to an official environment')
    }

    const domainName = this.retrieveDomainName()
    // Retrieve the Hosted Zone created manually
    this.hostedZone = HostedZone.fromHostedZoneAttributes(
      this.scope,
      `${this.props.stackName}-${this.props.region}-HostedZone`,
      {
        hostedZoneId,
        zoneName: domainName,
      },
    )

    // Create the certificate for your domain
    this.certificate = new DnsValidatedCertificate(
      this.scope,
      `${this.props.stackName}-${this.props.region}-Certificate`,
      {
        domainName,
        hostedZone: this.hostedZone,
        region: this.props.region,
      },
    )

    // Create the domain
    const domainCDKName = `${this.props.stackName}-${this.props.region}-DomainName`
    this.domain = new DomainName(this.scope, domainCDKName, {
      domainName,
      certificate: this.certificate,
    })
    overrideLogicalId(this.domain, AWS_RESOURCE_TYPE.API_GATEWAY.DOMAIN_NAME, domainCDKName)
  }

  private finalizeDomain(api: SpecRestApi): void {
    // Create the execute API URL
    const executeAPIDomainName = Fn.join('.', [
      api.restApiId,
      'execute-api',
      this.props.region,
      Fn.ref('AWS::URLSuffix'),
    ])
    // Create the health check
    const healthCheckName = `${this.props.stackName}-${this.props.region}-HealthCheck`
    const healthCheck = new CfnHealthCheck(this.scope, healthCheckName, {
      healthCheckConfig: {
        type: 'HTTPS',
        port: 443,
        fullyQualifiedDomainName: executeAPIDomainName,
        resourcePath: `/${api.deploymentStage.stageName}/health`,
      },
    })
    overrideLogicalId(healthCheck, AWS_RESOURCE_TYPE.ROUTE_53.HEALTH_CHECK, healthCheckName)

    // Now we create an ARecord to let route53 redirect to the lowest latency and healthy API
    const recordName = `${this.props.stackName}-${this.props.region}-ARecord`
    const record = new ARecord(this.scope, recordName, {
      recordName: this.retrieveDomainName(),
      zone: this.hostedZone,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      target: RecordTarget.fromAlias(new ApiGatewayDomain(this.domain!)),
    })
    // Link the Health Check with the record
    const recordSet = record.node.defaultChild as CfnRecordSet
    if (recordSet === undefined) {
      throw new Error('Record Set is undefined and Health Check cannot be link')
    }
    recordSet.region = this.props.region
    recordSet.healthCheckId = healthCheck.attrHealthCheckId
    recordSet.setIdentifier = `${this.props.stackName}-${this.props.region}-API`
    overrideLogicalId(recordSet, AWS_RESOURCE_TYPE.ROUTE_53.RECORD_SET, recordName)
  }

  private retrieveDomainName(): string {
    switch (this.props.stackName) {
      case 'LC-DEV':
        return 'dev.cloud.linearity.io'
      case 'LC-STG':
        return 'stg.cloud.linearity.io'
      case 'LC-PRD':
        return 'cloud.linearity.io'
      default:
        break
    }
    return ''
  }
}
