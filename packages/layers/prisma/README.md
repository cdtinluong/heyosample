# Database

We're using prisma for handling the communication between the DB and our handlers.

## Prerequisites

In terms of technologies they're the same than the root [README.md](../../../README.md).

In addition:
- PostgreSQL 14+

## Provisioning

You need to setup a local PGSQL database in order to work locally and to test your migrations.

Once the DB is setup, you need to set the environment variable `DATABASE_URL` such as:
```bash
export DATABASE_URL="postgresql://{username}:{password}@{host}:{port}/{db_name}"
```

## Commands

Some commands are already available in the root package.json which you can use.
Keep in mind all the commands below require to have `DATABASE_URL` set.

### Generate

In order for your code to compile and pass the linter, you need to have types from the DB. So you need to generate the types from the schema:
```bash
yarn prisma:generate
```

### Migration

You can always refer to this [documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate) for more command and details.

When you're changing a schema from `schema.prisma`, you need to create a migration:
```bash
yarn prisms:migrate --name "migration_name"
```

You can also create an empty migration to customize your update on the DB:
```bash
yarn prisma:migrate --name "migration_name" --create-only
```

### Deploy

While the command about migration will create the migration and then apply it, we need a way to just deploy changes:
```bash
yarn prisma:deploy
```

This command is the most trustworthy when it comes to deploy in production.

### Conflict Resolution

When you apply changes to your DB, some scripts may fail for some reason. You then need to update them and run your chanages once more.
However, before running your scripts, you first need to resolve the state of the failed script by running:
```bash
yarn workspace @layers/prisma prisma migrate resolve --rolled-back "migration_name"
```

## Squash Migrations

During developments, it can happen that a lot of changes are applied to the DB with some back and forth and thus, the number of migrations will gradually increase.

Once in a while, it's important to squash them into one file and start migrations from scratch.

For that you can start by reading this [documentation](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/squashing-migrations) and apply the strategy you prefer or follow my recommendations below.

### Process

1. Delete all migrations from the `migrations` folder

2. Create a new migration folder called `000000000000_squashed_migrations`

3. Export the schema of your most trustworthy DB into a file:
```bash
pg_dump $DATABASE_URL --schema-only > packages/layers/prisma/nodejs/migrations/000000000000_squashed_migrations/migration.sql
```

4. You then connect to all your DB using your schema and delete all migrations applied so far
```bash
echo 'DELETE FROM _prisma_migrations;' | psql $DATABASE_URL 
```

5. Finally you force apply your only migration to avoid it to be run
```bash
yarn workspace @layers/prisma prisma migrate resolve --applied "000000000000_squashed_migrations"
```

## DB connection

Since we set up VPC and DB proxies, we cannot directly access the DB anymore for obvious security reasons.

However, it may happen you need to connect to it to investigate some issues in DEV environment thus, below, you'll find the different command lines to do so.

You'll need 3 different terminals to execute the commands below in the order they're listed:

1. Connect to EC2
```bash
aws ssm start-session --profile {your_profile} --region eu-west-1 --target i-0ddf4bd5226b04d7d --document-name AWS-StartPortForwardingSession --parameters '{"portNumber":["22"], "localPortNumber":["2229"]}'
```

2. Create a SSH tunnel with RDS port
```bash
ssh -i ~/.ssh/lincloud-dev-kp.pem ubuntu@localhost -p 2229 -L 5444:lc-dev-resource-cluster.cluster-ro-cwtpjc6y0xaa.eu-west-1.rds.amazonaws.com:5432
```
*You can ask your manager to get the private key*
*Remove -ro from the cluster's name to access the writer instance*

3. Connect to the DB
```bash
psql postgresql://postgres:{db_password}@localhost:5444/lc_dev_resource?connect_timeout=300
```
