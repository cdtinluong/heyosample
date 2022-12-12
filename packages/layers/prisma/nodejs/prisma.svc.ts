import { PrismaClient } from '@layers/prisma'

export class PrismaService {
  protected client: PrismaClient

  public constructor(prismaClient: PrismaClient) {
    this.client = prismaClient
  }
}
