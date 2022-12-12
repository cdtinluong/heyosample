# Lin Cloud E2E Test API

## Prerequisites

- NodeJS >= 16
- yarn (Not using npm due to the workspaces feature)

## Provisioning

> In the e2e test, you need set environments on local computer

> -COGNITO_SECRET_HASH
> -COGNITO_CLIENT_ID
> -COGNITO_USERNAME
> -COGNITO_PASSWORD
> -COGNITO_API
> -API_ENDPOINT

## Useful Commands
Install packages:
```bash
yarn install
````

Execute the E2E Test:
```bash
yarn test
```

Run GUI E2E Test:
```bash
npx majestic
```