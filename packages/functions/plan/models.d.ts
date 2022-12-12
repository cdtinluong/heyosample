import { Prisma } from '@layers/prisma'

export interface PlanProductSelect {
  externalId: string
}

export interface PlanFindMany {
  id: string
  options: Prisma.JsonValue
  description: string | null
  advantagesDescription: string | null
  advantages: string[]
  isActive: boolean
  products: PlanProductSelect[]
}

export interface PlanSelect {
  id: string
  externalId: string
  options: Prisma.JsonValue
  description: string | null
  advantagesDescription: string | null
  advantages: string[]
  isActive: boolean
}
