# Lin Cloud

## Prerequisites

- NodeJS >= 16
- yarn (Not using npm due to the workspaces feature)
- [AWS SAM CLI](https://aws.amazon.com/serverless/sam/)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Docker (optional)](https://www.docker.com/products/docker-desktop): Docker is required for running at local

## Provisioning

> In the local development, you might need the local database, in this case, you can execute the provisioning command

> - database will be:
>   - host: `localhost`
>   - port: `5432`
>   - user: `local`
>   - password: `local`
>   - database: `postgres`
> - `pgadmin` is also installed:
>   - host: `http://localhost:5433`
>   - user: `admin@lin.cloud`
>   - pass: `local`

```bash
yarn provision:local
```

If you are using the postgres database in the docker container as above, you have to change the `host` when running the lambda functions locally
```bash
export DATABASE_URL="postgresql://local:local@host.docker.internal:5432/postgres?schema=public"
```

The `host` is very important: `host.docker.internal`. [Read more](https://docs.docker.com/desktop/mac/networking/)

## Useful Commands

Build the project:
```bash
yarn ci
````

Execute the Unit Test:
```bash
yarn test
```

Execute the Unit Test with coverage:
```bash
yarn test:cov
```

Linting:
```bash
yarn lint
```

Linting with automatic fix:
```bash
yarn lint:fix
```

Generate OpenAPI file:
```bash
yarn openapi:merge
````

## Development

### Start local development

Install dependencies
```bash
yarn ci
```

Adjust the environment variables
```json
{
  "Parameters": {
    "DATABASE_URL": "postgresql://local:local@localhost:5432/postgres?schema=public",
    // ... other environment variables
  }
}
```

Synthesize (CDK)
```bash
yarn synth
```

Start local
```bash
yarn serve
```

### Create new module

One `module` will contain multiple functions / APIs and it will be located under the `packages/functions` directory and the structure of the module will be:
```bash
│   ├── functions
│   │   ├── ping
│   │   │   ├── handlers.ts
│   │   │   ├── package.json
│   │   │   ├── services.ts
│   │   │   └── models.d.ts
```

- `handlers.ts`: contains all the handlers schema. One `handler` is one schema for the AWS Lambda function
- `package.json`: defines the dependencies of the `module`. Those packages are using for the `module` only
- `services.ts`: contains the logic to communicate with external services such as the DB or S3
- `models.d.ts`: defines all types, interfaces, ... for this specific module

You've two types of handler, one for the API and one for generic. You can check `packages/functions/auth/handlers.ts` for more information. YOu can see both hnalders in this file.

### Commit

We're using a commit convention to control messages with [husky](https://github.com/typicode/husky), [commitlint](https://github.com/conventional-changelog/commitlint) and [commitlint-jira](https://github.com/Gherciu/commitlint-jira).

E.g:

```bash
# ❌ Bad commit messages
git commit -m "My commit message body"
git commit -m ":My commit message body"
# ✅ Good commit messages
git commit -m "VN-2121, VN-21: My commit message body"
git commit -m "WEB-0000: My commit message body"
```

### Naming/Code Convention

* [CamelCase](https://en.wikipedia.org/wiki/Camel_case) convention for code development
* No `any` allowed except under extremely well documented reason
* [SnakeCase](https://en.wikipedia.org/wiki/Snake_case) for file names
* No plural in file naming

## Modules

### Cognito

[Details about Cognito](docs/COGNITO.md)

### Deployment

[Details about deployment](docs/DEPLOYMENT.md)

### Database

[Details about database and migration](packages/layers/prisma/README.md)

### CDK

[Details about CDK](packages/cdk/README.md)

### OpenAPI

We're using OpenAPI 3.0.1 to define our API documentation but also to deploy our resources into AWS.
This file is very important since it's containing an automatic request check and return error based on it.

You can generate the final OpenAPI file with:
```bash
yarn openapi:merge
```

It will be located in `docs/lincloud.yml` when the file we're working on are in `docs/openapi`.
The reason behind this is to be able to split the file into components so it's easier to manage.

#### Naming Convention

You need to keep your naming the same everywhere so by just taking a look you know what's going on:

**Everything is [CamelCase](https://en.wikipedia.org/wiki/Camel_case) in the document**

**Parameters**

In `parameters`, use the `name` property concatenated with `in`.

E.g:
```yaml
FileIDPath:
  in: path
  name: fileId
  required: true
  schema:
    type: string
    format: uuid
  description: File ID of the file
```

**RequestBodies and Responses**

In `requestBodies` and `responses`, use the method and the path of the endpoint excluding path parameters.

E.g:
```yaml
/file/{fileId}/download:
  post:
    requestBody:
      $ref: './components/file.yml#/components/requestBodies/PostFileDownload'
    responses:
      200:
        $ref: './components/file.yml#/components/responses/PostFileDownload'
```

In case the response or requestBody is used many time, you can update the name such as:
```yaml
GenericHierarchiesResponse:
  type: object
```

**Schemas**

In `schemas`, you have five categories for now:
* Enum: defines a reusable enum and should be named for what it stands for -> `CustomCode`
* Model: refers to data taken from the DB and returned through the API. It should be named the same way than enum, as simply as possible -> `User`
* Regex: Same than above but add `Regex` at the end -> `FolderRegex`
* Response: it's the schema used by a response mentioned above. You take the same name than the response and you add `Response` -> `PostFileDownloadResponse`
* Request: same than Response -> `PostFileDownloadRequest`

We're defining schemas to be included in `responses` and `requestBody` so they're created as `model` in API Gateway and be used as validators.

**For other kind of naming or definitions, you've plenty of example in the OpenAPI file. You can always ask to someone from the team if you're not sure.**
