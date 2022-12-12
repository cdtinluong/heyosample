/* eslint-disable @typescript-eslint/no-unsafe-return */
import httpResponseSerializer from '@middy/http-response-serializer'
import isString from 'lodash/isString'
import { Response } from '../response'

export default () =>
  httpResponseSerializer({
    serializers: [
      {
        regex: /^application\/json$/,
        serializer: ({ body }) => (isString(body) ? body : new Response().Ok(body)),
      },
      {
        regex: /^text\/plain$/,
        serializer: ({ body }) => body,
      },
    ],
    defaultContentType: 'application/json',
  })
