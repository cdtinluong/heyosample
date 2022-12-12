import { Prisma, MigrationStatus, UserAction } from '@layers/prisma'

export interface OrganizationSelect {
  organizationId: string
}

export interface UserSelect {
  id: string
  email: string
  name: string
  migrationStatus: MigrationStatus | null
  isActive: boolean | null
  deleteAt: Date | null
}

export interface UserWithOrgSelect extends UserSelect {
  organizations: OrganizationSelect[]
}

export interface UserHistorySelect {
  action: UserAction
  details: Prisma.JsonValue
  deviceId: string
  createdAt: Date
}

export interface UserPlanSelect {
  id: string
  externalId: string
  options: Prisma.JsonValue
  description: string | null
  advantagesDescription: string | null
  advantages: string[]
  isActive: boolean
  transactionId: string
  createdAt: Date
  expireAt: Date | null
}
