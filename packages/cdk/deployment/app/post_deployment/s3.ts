import * as fs from 'fs'
import * as path from 'path'
import AWS from 'aws-sdk'
import env from 'cdk/lib/env'

export async function run() {
  console.info('Start to upload openAPI file to s3')
  const S3 = new AWS.S3({
    region: env.RESOURCE_REGION,
  })

  await S3.putObject({
    Body: fs.createReadStream(path.join(__dirname, '../../../../../docs/lincloud.yml')),
    Bucket: `${env.RESOURCE_STACK_NAME}-openapi`.toLowerCase(),
    Key: 'lincloud.yml',
    ACL: 'public-read',
    ContentType: 'text/x-yaml',
    ContentDisposition: 'inline',
  }).promise()
}
