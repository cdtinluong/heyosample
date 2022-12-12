import { createHttpHandler } from '@layers/core/lib/http-handler'
import * as handlers from './handlers'

export const postRevenueCat = createHttpHandler(handlers.postRevenueCat)
