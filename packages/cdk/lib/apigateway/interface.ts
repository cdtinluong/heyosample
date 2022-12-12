import { Role } from 'aws-cdk-lib/aws-iam'

export interface CorsOption {
  credentials?: boolean | string
  headers?: string
  methods?: string
  origin?: string
  origins?: string[]
  requestHeaders?: string
  requestMethods?: string
}

export interface RoleObject {
  role: Role
  roleName: string
}

export interface SingleApiGatewayProps {
  account: string
  region: string
  cors?: CorsOption
}

export interface ICorsResourceProps {
  responses?: {
    default: {
      statusCode: string
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': string
        'method.response.header.Access-Control-Allow-Origin': string
        'method.response.header.Access-Control-Allow-Methods': string
        'method.response.header.Access-Control-Allow-Credentials': boolean
      }
      responseTemplates?: {
        [key: string]: string
      }
    }
  }
  requestTemplates?: {
    [key: string]: string
  }
  passthroughBehavior?: string
}

export interface ApiProperties {
  'x-amazon-apigateway-integration': {
    httpMethod: string
    type: string
    uri: string
    credentials: string
  }
}
