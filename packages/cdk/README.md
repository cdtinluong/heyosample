# LinCloud CDK

## Stacks

Right now the project is split into 3 stacks which are dependents in a hierarchical way but most be deployed in a certain order to ensure the stability of the project.

The hierarchical order mentioned above is the same than the order in the list below.

### Cross Region

The purpose of this stack is to create resources on multiple regions during the deployment.

Right now, this stack has a small specifity because of the way CDK is creating resources.
Basically, some resources require for another resource to exist to be able to be deployed so if you try to create them at the same time it won't work.
That's the case when you want to setup a S3 MRAP with a cross replication between buckets.

You first need to create the buckets before being able to create the replication rules and finally create the MRAP.

That's why a parameter has been implemented when deploying this stack such as:
```bash
yarn deploy:cross-region --require-approval never --context initialDeploy=true
```
OR
```bash
yarn deploy:cross-region --require-approval never --context initialDeploy=false
```

The first command line will create the bucket and the second will create the replication rules.

**Important Note: this stack is automatically deployed if a change is detected from `packages/cdk/lib/env.ts` and `packages/cdk/stacks/cross_region/**`**

### Resource

This stack will create all shared resources between stacks into a single region.

It's currently the most straightforward stack and the easiest to deploy (though the longest on the first deployment).

```bash
yarn deploy:resource --require-approval never
```

**Important Note: this stack is automatically deployed if a change is detected from `packages/cdk/lib/env.ts`, `packages/cdk/stack/resource/**`, `packages/functions/auth/handlers.ts` and `packages/functions/auth/services.ts`**

### App

This stack contains everything related to API and lambda.
It could be described as the logic stack where the business logic is implemented.

The App Stack has three specificities when it comes to deployment.

**Pre Deployment**
Where we'll retrieve information CDK cannot get by itself and display them in the console.

E.g: MRAP alias or DB URL.

The command below will automatically insert the data into the environment.
```bash
eval "$(yarn run --silent deploy:app:pre)"
```

The script can be found in `packages/cdk/deployment/app/pre_deployment.ts`.

**Deployment**
Where we simply deploy the stack.
```bash
yarn deploy:app --require-approval never
```

**Post Deployment**
Where we apply some more logic that CDK is not able to perform by itself.

E.g: Nullable script or setting up Cognito authorizer
```bash
yarn deploy:app:post
```

The script can be found in `packages/cdk/deployment/app/post_deployment.ts`.

for vpc peering: We need to run the peering command after the deployment (Run onetime)

## Nested Stack

In all the description below, you can find existing example in the project.

### Cross Region

To add a new nested stack into the Cross Region, you just need to create a new file in `packages/cdk/stacks/cross_region/*` and import it to `packages/cdk/stacks/cross_region/cross_region.stack.ts`.

### Resource

To add a new nested stack into the Cross Region, you just need to create a new file in `packages/cdk/stacks/resource/*` and import it to `packages/cdk/stacks/resource/resource.stack.ts`.

### App

To add a new nested stack (representing an API), create a file in `packages/cdk/stacks/app/lambda/*` and import it to `packages/cdk/stacks/app/app.stack.ts`.

## Important Notes

* **All environment variables needed for the project are present in `packages/cdk/lib/env.ts`**
* Using NestedStack is important in order to not hit the limit of 500 resources per stack
* You should always use `overrideLogicalId` when creating a new resource with CDK, it will avoid to duplicate resources but also it will avoid some unexpected behaviour where a resource is deleted then re-created
* When creating a new stack or nested stack, always add `.stack.` in the name

## Useful Commands

* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
