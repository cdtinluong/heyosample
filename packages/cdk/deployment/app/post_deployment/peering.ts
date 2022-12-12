// this script is use to clean up the black hold in master stack
// NOTE: Uncomment the runner line to run
// USAGE: AWS_PROFILE=<PROFILE> AWS_REGION=<REGION>  ts-node packages/cdk/deployment/app/post_deployment/peering.ts
import { DeleteRouteCommand, EC2Client, DescribeRouteTablesCommand } from '@aws-sdk/client-ec2'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const runner = async () => {
  const ec2Client = new EC2Client({})
  const descRoutesResult = await ec2Client.send(
    new DescribeRouteTablesCommand({
      Filters: [
        {
          Name: 'route.state',
          Values: ['blackhole'],
        },
      ],
    }),
  )
  // get routes
  if (descRoutesResult.RouteTables != null) {
    const deleteContents = descRoutesResult.RouteTables.flatMap((route) => {
      const blackHolesRoutes = route.Routes?.filter((r) => r.State === 'blackhole') ?? []
      return blackHolesRoutes.map((bhr) => ({
        RouteTableId: route.RouteTableId,
        DestinationCidrBlock: bhr.DestinationCidrBlock,
      }))
    })
    console.log('delete content: %j', deleteContents)
    await Promise.all(deleteContents.map(async (item) => ec2Client.send(new DeleteRouteCommand(item))))
  }
}

// TODO: To run, please uncomment this
// runner().then(console.log, console.error)
