/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-param-reassign */
import { OpenAPIV3 } from 'openapi-types'

import { removeNullableFromArr, hasOwnProperty } from 'cdk/lib/utils'
import { ApiProperties } from 'cdk/lib/apigateway/interface'

const forbiddenProps = ['readOnly', 'writeOnly', 'x-tags', 'x-examples', 'example', 'nullable', 'deprecated']

function fixSchema(schema: OpenAPIV3.SchemaObject) {
  const { nullable } = schema
  delete schema.nullable
  /// @ts-expect-error // ignore this
  forbiddenProps.forEach((prop) => delete schema[prop])

  if (nullable !== true) return schema
  /// @ts-expect-error // ignore this
  schema.type = removeNullableFromArr([...new Set(['null', schema.type].flat())])

  if (Array.isArray(schema.enum)) {
    schema.enum = [...new Set([null, ...(schema.enum as string[])])]
  }

  return schema
}

// eslint-disable-next-line no-unused-vars
type EachRecursiveCallbackType<T extends object> = (o: T) => T
// This function handles arrays and objects
function eachRecursive<T extends object>(obj: T, fn: EachRecursiveCallbackType<T>) {
  obj = fn(obj)
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      /// @ts-expect-error // this key must exists
      obj[key] = fn(value)
      eachRecursive(value, fn)
    }
  })
}

/**
 * Fix the OpenApi Definition to be used with AWS.
 *
 * @param document OpenApi Document to fix for AWS
 * @param refPrefix replace all refs with this prefix (to make the schemas compatible with AWS)
 */
export function fixOpenApiDefinition(document: OpenAPIV3.Document<ApiProperties>, refPrefix?: string) {
  function fixRef(schema: OpenAPIV3.ReferenceObject) {
    if (hasOwnProperty(schema, '$ref')) {
      schema.$ref = schema.$ref.replace('#/components/schemas/', refPrefix ?? '')
    }
    return schema
  }

  if (refPrefix != null) {
    /// @ts-expect-error // this will also tolerate wrong input
    eachRecursive(document, fixRef)
  }

  const schemas = document.components?.schemas
  if (schemas != null) {
    Object.values(schemas).map((value) => {
      const fixed = value
      /// @ts-expect-error // this will also tolerate wrong input
      eachRecursive(fixed, fixSchema)
      return fixed
    })
  }
}
