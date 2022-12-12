# LinCloud Deployment

Deployment is runned with Github Actions and use CDK as IaC.

## Structure

THe process of deployment is pretty straightforward since it's split in 2.

1. PR Review where a developer create a Pull Request and is requesting a review. At that time, some checks are made to ensure the code quality.

2. Deployment where a PR is merged into a specific branch.

### PR Review

Currently, we have 3 main branches where checks are mandatory and where this process apply:

* `develop`: DEV environment
* `staging`: STG environment
* `main`: PRD environment

When a PR is created for one of these branches then the workflow [pr_review](.github/workflows/pr_review.yml) is triggered where cheks will be made:

* Build: check if the build is possible
* Linting: no linting error is accepted
* Unit Test: all unit tests must run smoothly
* Unit Test Coverage: a test coverage below 90 won't be accepted

### Deployment

The deployment with Github Actions is split in two files [deploy_env](.github/workflows/deploy_env.yml) and [deploy_stacks](.github/workflows/deploy_stacks.yml).

The first one will define what kind of ENV we're actually deploying into (it can be none if not matching one of the branches mentioned above).

The second one will proceed with the deployment.

You may look into this [file](packages/cdk/README.md) to have more information about CDK deployment.

As a quick overview and with dependencies you can think of the deployment as such:

* Build
* Deploy Cross Region stack
* Deploy Cross Region stack with more parameters
* Deploy Resource stack
* Run pre-app stack script
* Deploy App stack
* Run post-app stack script
* Apply DB migrations

## Environment

All environment variables are defined in [Github Environment](https://github.com/LinearityGmbH/LinCloud-BE/settings/environments).

You can then add them into the `env` from `.github/workflows/deploy_stacks.yml` so they're available for your project and Github Actions.

## Issues
If we delete a peering stack from the replicate region => We need to delete the peering stack on the master stack as well, then re-deploy the peering* stack to re-create the stack again Or Thre will be a blackhole in routing table of the subnet, This mean the routing point to invalid resource.

# Redeployment without change
- create PR by adding some comments and merge to develop