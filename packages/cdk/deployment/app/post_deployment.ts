import { run as runAPIGateway } from './post_deployment/apigateway'
import { run as runS3 } from './post_deployment/s3'

// eslint-disable-next-line no-void
void (async () => {
  // Launch the post deployment script for the OpenAPI file upload to S3
  await runS3()
  // Launch the post deployment script for the API Gateway
  const regions = (process.env.REPLICATION_REGIONS ?? '').split(',').filter((o) => o)
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  regions.forEach(async (region) => {
    try {
      await runAPIGateway(region)
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })
})()
