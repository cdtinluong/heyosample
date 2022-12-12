import { createHandler } from '@layers/core/lib/handler'
import { createHttpHandler } from '@layers/core/lib/http-handler'
import * as handlers from './handlers'

export const cognitoUserConfirmed = createHandler(handlers.cognitoUserConfirmed)
export const cognitoPreSignUp = createHandler(handlers.cognitoPreSignUp)
export const cognitoPreToken = createHandler(handlers.cognitoPreToken)
export const cognitoCustomEmailSender = createHandler(handlers.cognitoCustomEmailSender)
export const postAuthLogin = createHttpHandler(handlers.postAuthLogin)
export const postAuthLogout = createHttpHandler(handlers.postAuthLogout)
