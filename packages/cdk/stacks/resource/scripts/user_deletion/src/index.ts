import { runScript } from './script'

runScript()
  .then(() => {
    console.log('Job was executed successfully')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Execute job failed', err)
    process.exit(1)
  })
