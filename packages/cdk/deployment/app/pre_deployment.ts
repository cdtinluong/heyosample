import { run as runEnv } from './pre_deployment/env_variables'

// Launch the pre deployment script to set mandatory env variables
runEnv().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
