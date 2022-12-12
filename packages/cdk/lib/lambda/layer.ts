import { Construct } from 'constructs'
import { IgnoreMode } from 'aws-cdk-lib'
import { Architecture, Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import env from 'cdk/lib/env'
import path from 'path'

export function createCoreLayer(scope: Construct) {
  return new LayerVersion(scope, 'LayerCore', {
    layerVersionName: `${env.STACK_NAME}-Core`,
    compatibleRuntimes: [Runtime.NODEJS_16_X],
    compatibleArchitectures: [Architecture.ARM_64],
    code: Code.fromAsset(path.join(__dirname, '../../../layers/core'), { exclude: ['*.ts', 'aws-sdk'] }),
    description: `The ${env.STACK_NAME} core layer`,
  })
}

export function createPrismaLayer(scope: Construct) {
  return new LayerVersion(scope, 'layer-prisma', {
    layerVersionName: `${env.STACK_NAME}-Prisma`,
    compatibleRuntimes: [Runtime.NODEJS_16_X],
    compatibleArchitectures: [Architecture.ARM_64],
    code: Code.fromAsset(path.resolve(__dirname, '../../../layers/prisma'), {
      ignoreMode: IgnoreMode.GLOB,
      exclude: [
        '*.ts',
        'nodejs/migrations',
        'nodejs/node_modules/@prisma/engines',
        'nodejs/node_modules/@prisma/client/node_modules',

        'nodejs/node_modules/.prisma/client-test',
        'nodejs/node_modules/.prisma/client/libquery_engine-debian-*',
        '!nodejs/node_modules/.prisma/client/libquery_engine-rhel-*',

        'nodejs/node_modules/.bin',
        'nodejs/node_modules/prisma',
      ],
    }),
    description: `The ${env.STACK_NAME} prisma (database) layer`,
  })
}

export function createFileLayer(scope: Construct) {
  return new LayerVersion(scope, 'layer-file', {
    layerVersionName: `${env.STACK_NAME}-File`,
    compatibleRuntimes: [Runtime.NODEJS_16_X],
    compatibleArchitectures: [Architecture.ARM_64],
    code: Code.fromAsset(path.resolve(__dirname, '../../../layers/file'), {
      ignoreMode: IgnoreMode.GLOB,
      exclude: ['*.ts'],
    }),
    description: `The ${env.STACK_NAME} file layer`,
  })
}
