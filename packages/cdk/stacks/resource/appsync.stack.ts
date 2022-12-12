import path from 'path'
import { readFileSync } from 'fs'

import { Construct } from 'constructs'
import { NestedStack, Stack } from 'aws-cdk-lib'
import { AWS_RESOURCE_TYPE, overrideLogicalId } from 'cdk/lib/utils'
import { CfnDataSource, CfnGraphQLApi, CfnGraphQLSchema, CfnResolver } from 'aws-cdk-lib/aws-appsync'
import { BaseNestedStackProps } from '../../lib/stack.interface'

export class AppSyncResourceStack extends NestedStack {
  public constructor(scope: Construct, id: string, protected props: BaseNestedStackProps) {
    super(scope, id, props)
    // Create appsync resource
    this.createAppSync()
  }

  private createAppSync() {
    const graphApiName = `${this.props.parentStackName}-appsync-gph-api`
    if (this.props.environment?.USER_POOL_ID == null) throw new Error('Missing USER_POOL_ID setting')

    // create app sync api
    const graphApi = new CfnGraphQLApi(this, 'Api', {
      name: graphApiName,
      authenticationType: 'AMAZON_COGNITO_USER_POOLS',
      userPoolConfig: {
        userPoolId: this.props.environment?.USER_POOL_ID,
        awsRegion: Stack.of(this).region,
        defaultAction: 'ALLOW',
      },
      xrayEnabled: true,
    })
    overrideLogicalId(graphApi, AWS_RESOURCE_TYPE.APP_SYNC.GRAPH_API, graphApiName)

    // create api schema
    const schemaContent = readFileSync(path.resolve(__dirname, 'graphql/schema.graphql')).toString()
    const graphSchemaName = `${this.props.parentStackName}-graph-schema`
    const apiSchema = new CfnGraphQLSchema(this, 'GraphSchema', {
      apiId: graphApi.attrApiId,
      definition: schemaContent,
    })
    overrideLogicalId(graphApi, AWS_RESOURCE_TYPE.APP_SYNC.GRAPH_SCHEMA, graphSchemaName)

    // create NONE source for local resolver
    const nonDataSourceName = `${this.props.parentStackName}-non-data-source`.replace(/-/gi, '_') // prevent using stack name with -
    const nonDataSource = new CfnDataSource(this, 'NonDataSource', {
      apiId: graphApi.attrApiId,
      name: nonDataSourceName,
      type: 'NONE',
    })
    overrideLogicalId(graphApi, AWS_RESOURCE_TYPE.APP_SYNC.DATA_SOURCE, nonDataSourceName)

    const userDataChangedResolver = new CfnResolver(this, 'LocalResolver', {
      apiId: graphApi.attrApiId,
      dataSourceName: nonDataSource.attrName,
      typeName: 'Mutation',
      fieldName: 'dataChanged', // mutation name
      requestMappingTemplate: `
      {
        "version": "2017-02-28",
        "payload": $util.toJson($context.arguments.input)
      }`,
      responseMappingTemplate: `$util.toJson($context.result)`,
    })

    userDataChangedResolver.addDependsOn(apiSchema)
  }
}
