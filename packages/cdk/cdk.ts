#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import 'source-map-support/register'
import env from 'cdk/lib/env'
import { AppStack } from 'cdk/stacks/app/app.stack'
import { ResourceStack } from 'cdk/stacks/resource/resource.stack'
import { CrossRegionStack } from 'cdk/stacks/cross_region/cross_region.stack'
import { partition } from 'lodash'

const app = new App()
// mapping cidr for the VPC
const regionCidrMapping: Record<string, string> = {
  'eu-west-1': '192.168.0.0/16',
  'ap-southeast-1': '192.169.0.0/16',
  'us-west-2': '192.171.0.0/16',
}

// validate missing cidr mapping
env.REPLICATION_REGIONS.forEach((region) => {
  if (regionCidrMapping[region] == null) throw new Error(`Missing CIDR mapping for region: ${region}`)
})

const [masterRegions, replicateRegions] = partition(env.REPLICATION_REGIONS, (region) => region === env.CDK_REGION)
if (masterRegions.length === 0) throw new Error('Missing the CDK_REGION')

// create master stack cross region
const masterVpcCidr = regionCidrMapping[env.CDK_REGION]
const masterCrossRegionName = `CrossRegion-${masterRegions[0]}`
const masterCrossRegionStack = new CrossRegionStack(app, masterCrossRegionName, {
  stackName: env.CROSS_REGION_STACK_NAME,
  env: {
    account: env.CDK_ACCOUNT,
    region: masterRegions[0],
  },
  tags: {
    owner: env.STACKS_OWNER,
    Stage: env.STAGE,
    Application: env.CROSS_REGION_STACK_NAME,
    ApplicationRole: masterCrossRegionName,
  },
  initialDeploy: (app.node.tryGetContext('initialDeploy') ?? '') as string,
  terminationProtection: true,
  vpcCidr: regionCidrMapping[masterRegions[0]],
  masterVpcCidr,
  masterRegion: env.CDK_REGION,
})

// Create CrossRegion stacks
const crossRegionReplicateStacks = replicateRegions.map((region) => {
  const crossRegionName = `CrossRegion-${region}`
  return new CrossRegionStack(app, crossRegionName, {
    stackName: env.CROSS_REGION_STACK_NAME,
    env: {
      account: env.CDK_ACCOUNT,
      region,
    },
    tags: {
      owner: env.STACKS_OWNER,
      Stage: env.STAGE,
      Application: env.CROSS_REGION_STACK_NAME,
      ApplicationRole: crossRegionName,
    },
    initialDeploy: (app.node.tryGetContext('initialDeploy') ?? '') as string,
    terminationProtection: true,
    vpcCidr: regionCidrMapping[region],
    masterVpcCidr,
    masterRegion: env.CDK_REGION,
  })
})
// replicate stacks must waiting for the master stack to be finished
crossRegionReplicateStacks.forEach((stack) => stack.addDependency(masterCrossRegionStack))

// Create resource stack
const resourceStack = new ResourceStack(app, 'Resource', {
  stackName: env.RESOURCE_STACK_NAME,
  regionCidrMapping,
  replicateRegions,
  env: {
    account: env.CDK_ACCOUNT,
    region: env.CDK_REGION,
  },
  tags: {
    owner: env.STACKS_OWNER,
    Stage: env.STAGE,
    Application: env.RESOURCE_STACK_NAME,
    ApplicationRole: 'Resource',
  },
  terminationProtection: true,
})

// make sure the resource stack will run after the cross region stack (because of the vpc)
crossRegionReplicateStacks.forEach((stack) => resourceStack.addDependency(stack))

// Create app stack
// eslint-disable-next-line @typescript-eslint/no-misused-promises
env.REPLICATION_REGIONS.forEach(async (region) => {
  const appStackName = `App-${region}`
  const appStack = new AppStack(app, appStackName, {
    stackName: env.STACK_NAME,
    env: {
      account: env.CDK_ACCOUNT,
      region,
    },
    tags: {
      owner: env.STACKS_OWNER,
      Stage: env.STAGE,
      Application: env.STACK_NAME,
      ApplicationRole: appStackName,
    },
    resources: {
      secret: resourceStack.db.getSecret(),
      cognito: resourceStack.cognito.getCognito(),
    },
  })

  // Initialization
  await appStack.init()
})
