import { Prisma, Role, OrgAction, UserHistory } from '@layers/prisma'
import { PrismaService } from '@layers/prisma/prisma.svc'
import { sendAmplitudeEvent, EventType } from 'amplitude/services'
import { CognitoIdentityServiceProvider } from 'aws-sdk'
import env from 'cdk/lib/env'
import { sendEmail, emailTriggerSource } from 'email/services'
import { UserHistorySelect, UserSelect, UserWithOrgSelect, UserPlanSelect } from './models'

const NB_ITEMS = 25

export class UserService extends PrismaService {
  public async createNewUser(user: Prisma.UserCreateInput): Promise<void> {
    const existingUser = await this.client.user.findFirst({
      where: { email: user.email },
      select: { id: true },
    })

    if (existingUser) {
      return Promise.resolve()
    }

    const organization: Prisma.OrganizationCreateWithoutUsersInput = {
      id: user.id,
      name: user.name,
      description: `${user.name}'s Organization`,
      isActive: true,
    }

    // Create new user with default organization
    // Nothing is returned by prisma...
    await this.client.user.create({
      data: {
        ...user,
        organizations: {
          create: {
            organization: {
              create: {
                ...organization,
                organizationHistories: {
                  createMany: {
                    data: [
                      {
                        requesterId: user.id,
                        action: OrgAction.CREATED,
                        details: organization as Prisma.InputJsonObject,
                      },
                      {
                        requesterId: user.id,
                        action: OrgAction.USER_ADDED,
                        details: user as Prisma.InputJsonObject,
                      },
                    ],
                  },
                },
              },
            },
            role: Role.ADMIN,
          },
        },
      },
    })

    await sendAmplitudeEvent({
      event_type: EventType.UserCreated,
      user_id: user.id ?? '',
      user_properties: {
        linCloud: 'enabled',
        userType: 'email',
      },
    })

    return Promise.resolve()
  }

  public async createUserHistory(data: Prisma.UserHistoryUncheckedCreateInput): Promise<UserHistory> {
    // Create an entry in the table UserHistory
    return this.client.userHistory.create({
      data,
    })
  }

  public async getUser(id: string): Promise<UserSelect | null> {
    return this.client.user.findFirst({
      where: { id, deleteAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deleteAt: true,
        migrationStatus: true,
      },
    })
  }

  public async getDeletedUser(id: string): Promise<UserSelect | null> {
    return this.client.user.findFirst({
      where: {
        id,
        deleteAt: { not: null },
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deleteAt: true,
        migrationStatus: true,
      },
    })
  }

  public async getUserWithOrg(id: string): Promise<UserWithOrgSelect | null> {
    return this.client.user.findFirst({
      where: { id, deleteAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deleteAt: true,
        migrationStatus: true,
        organizations: true,
      },
    })
  }

  public async updateUser(id: string, user: Prisma.UserUpdateInput): Promise<UserSelect | null> {
    return this.client.user.update({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deleteAt: true,
        migrationStatus: true,
      },
      data: user,
    })
  }

  public async deleteUser(id: string): Promise<void> {
    const now = new Date()
    const deleteAt = new Date(now.setDate(now.getDate() + 30)) // 30 days is the actual delete period
    const cognitoIdp = new CognitoIdentityServiceProvider({ region: env.RESOURCE_REGION })

    await Promise.all([
      cognitoIdp
        .adminDisableUser({
          Username: id,
          UserPoolId: env.COGNITO_USER_POOL_ID,
        })
        .promise(),
      cognitoIdp
        .adminUserGlobalSignOut({
          UserPoolId: env.COGNITO_USER_POOL_ID,
          Username: id,
        })
        .promise(),
      this.client.user.update({
        where: { id },
        data: { deleteAt },
      }),
    ])

    await sendEmail(emailTriggerSource.CustomEmailSender_AccountDeactivation, id)
  }

  public async getUserHistory(userId: string, page = 1): Promise<UserHistorySelect[]> {
    return this.client.userHistory.findMany({
      where: {
        userId,
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
      select: {
        action: true,
        details: true,
        deviceId: true,
        createdAt: true,
      },
      skip: (page - 1) * NB_ITEMS,
      take: NB_ITEMS,
    })
  }

  /**
   * Get all user plans history
   *
   * @param userId to identity the user
   * @returns array of user plans
   */
  public async getUserPlans(userId: string): Promise<UserPlanSelect[]> {
    return this.fetchUserPlans(userId, false)
  }

  /**
   * Get the current user plan
   *
   * @param userId to identity the user
   * @returns array of user plans
   */
  public async getUserPlan(userId: string): Promise<UserPlanSelect | null> {
    const userPlans = await this.fetchUserPlans(userId, true)

    return userPlans[0]
  }

  /**
   * Private method used by getUserPlans and getUserPlan
   *
   * @param userId to identity the user
   * @param isCurrent to define if we want the history or the current plan
   * @returns array of user plans
   */
  private async fetchUserPlans(userId: string, isCurrent = false): Promise<UserPlanSelect[]> {
    const condition: Prisma.UserPlanWhereInput = {
      userId,
      isActive: true,
      user: {
        deleteAt: null,
      },
    }
    // Filter for the current plan
    if (isCurrent === true) {
      condition.expireAt = {
        gte: new Date(),
      }
    }

    const userPlans = await this.client.userPlan.findMany({
      where: condition,
      select: {
        id: true,
        transactionId: true,
        expireAt: true,
        createdAt: true,
        isActive: true,
        planProduct: {
          select: {
            externalId: true,
          },
        },
        plan: {
          select: {
            options: true,
            description: true,
            advantages: true,
            advantagesDescription: true,
          },
        },
      },
    })

    return userPlans.map((userPlan) => ({
      id: userPlan.id,
      externalId: userPlan.planProduct.externalId,
      transactionId: userPlan.transactionId,
      options: userPlan.plan.options,
      description: userPlan.plan.description,
      advantages: userPlan.plan.advantages,
      advantagesDescription: userPlan.plan.advantagesDescription,
      expireAt: userPlan.expireAt,
      createdAt: userPlan.createdAt,
      isActive: userPlan.isActive,
    }))
  }
}
