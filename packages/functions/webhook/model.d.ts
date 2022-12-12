import { Store } from '@layers/prisma'

export interface RevenueCatRequest {
  api_version: string
  event: Event
}

export interface Event {
  aliases: string[]
  app_id: string
  app_user_id: string
  country_code: string
  currency: string
  entitlement_id: string
  entitlement_ids: string[]
  environment: string
  event_timestamp_ms: number
  expiration_at_ms: number | null
  id: string
  is_family_share: boolean
  offer_code: string
  original_app_user_id: string
  original_transaction_id: string
  period_type: string
  presented_offering_id: string
  price: number
  price_in_purchased_currency: number
  product_id: string
  purchased_at_ms: number
  store: Store
  subscriber_attributes: object
  takehome_percentage: number
  transaction_id: string
  type: string
  cancel_reason: string
  new_product_id: string
}
