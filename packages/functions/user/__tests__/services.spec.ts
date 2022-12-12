import { Prisma, Role, OrgAction, UserAction } from '@layers/prisma'
import { faker } from '@faker-js/faker'
import random from 'lodash/random'
import { UserService } from '../services'

const findFirst = jest.fn()
const findMany = jest.fn()
const update = jest.fn()
const create = jest.fn()

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  user: {
    findFirst,
    findMany,
    update,
    create,
  },
  userHistory: {
    findMany,
    create,
  },
  userPlan: {
    findMany,
  },
}

const mCognitoIdentityServiceProvider = {
  adminDisableUser: jest.fn().mockReturnThis(),
  adminUserGlobalSignOut: jest.fn().mockReturnThis(),
  promise: jest.fn(),
}
jest.mock('aws-sdk', () => {
  return {
    CognitoIdentityServiceProvider: jest.fn(() => mCognitoIdentityServiceProvider),
  }
})

jest.mock('../../email/services', () => ({
  ...jest.requireActual('../../email/services'),
  sendEmail: jest.fn(),
  createBrazeUser: jest.fn(),
}))

describe('user/services.ts', () => {
  const userService = new UserService(prismaClient)
  const userId = faker.datatype.uuid()
  const deviceId = faker.datatype.uuid()

  describe('GET /user', () => {
    it('Returns user if the user id is provided', async () => {
      const user = {
        id: userId,
        email: faker.internet.email(),
        name: faker.name.fullName(),
        isActive: random(0, 1),
        deviceId,
      }
      findFirst.mockReturnValue(Promise.resolve(user))
      return userService.getUser(userId).then((result) => {
        expect(result).toEqual(user)
      })
    })

    it('Throws an error if the user id does not exist', async () => {
      findFirst.mockReturnValue(Promise.resolve(null))
      return userService.getUser(userId).catch((err) => {
        expect(err).toBeDefined()
      })
    })
  })

  describe('getDeletedUser', () => {
    it('should get deleted user successfully', async () => {
      await userService.getDeletedUser(userId)

      expect(findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
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
    })
  })

  describe('PATCH /user', () => {
    it('Updates the user', async () => {
      const user = {
        id: userId,
        email: faker.internet.email(),
        name: faker.name.fullName(),
        isActive: random(0, 1),
        deviceId,
      }
      update.mockReturnValue(Promise.resolve(user))
      return userService.updateUser(userId, { name: user.name }).then((result) => {
        expect(result).toEqual(user)
      })
    })

    it('Throws an error if the user id does not exist', async () => {
      update.mockReturnValue(Promise.resolve(null))
      return userService.updateUser(userId, { name: 'user.name' }).catch((err) => {
        expect(err).toBeDefined()
      })
    })
  })

  describe('DELETE /user', () => {
    it('Sets user in delete mode', async () => {
      const user = {
        id: userId,
        deleteAt: new Date(),
      }
      update.mockReset().mockResolvedValue(user)
      mCognitoIdentityServiceProvider.promise.mockReset().mockResolvedValue({})

      await userService.deleteUser(userId)

      expect(update).toHaveBeenCalledTimes(1)
      expect(mCognitoIdentityServiceProvider.promise).toHaveBeenCalledTimes(2)
    })
  })

  describe('GET /user/history', () => {
    it('Returns history if the user id is provided', () => {
      const createdAt = new Date()
      findMany.mockReturnValue(
        Promise.resolve([
          {
            action: 'LOGIN',
            details: {
              device_id: 'unit-test',
            },
            createdAt,
          },
        ]),
      )
      return userService.getUserHistory(userId).then((result) => {
        expect(result).toEqual([
          {
            action: 'LOGIN',
            details: {
              device_id: 'unit-test',
            },
            createdAt,
          },
        ])
      })
    })

    it('Throws an error if the user id does not exist', () => {
      findFirst.mockReturnValue(Promise.resolve(null))
      return userService.getUserHistory(userId).catch((err) => {
        expect(err).toBeDefined()
      })
    })
  })

  describe('Create User', () => {
    const firstName = faker.name.fullName()
    const lastName = faker.name.lastName()
    const user: Prisma.UserCreateInput = {
      id: userId,
      email: faker.internet.email(),
      name: `${firstName} ${lastName}`,
      isActive: true,
      deviceId,
    }
    const organization = {
      id: user.id,
      name: user.name,
      description: `${user.name}'s Organization`,
      isActive: true,
    }

    it('Create a new user with a default organization', async () => {
      console.info('Create user')
      await userService.createNewUser(user)
      expect(prismaClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
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
        }),
      })
    })

    it('Do not create user since user already exists', async () => {
      prismaClient.user.create.mockReset().mockResolvedValueOnce()
      prismaClient.user.findFirst.mockReset().mockResolvedValueOnce({ id: userId })

      await userService.createNewUser(user)
      expect(prismaClient.user.create).toBeCalledTimes(0)
    })
  })

  describe('Add Auth as History', () => {
    it('POST /auth/login: Success', async () => {
      const login: Prisma.UserHistoryUncheckedCreateInput = {
        userId,
        action: UserAction.LOGIN,
        details: { deviceId },
        deviceId,
      }
      await userService.createUserHistory(login)
      expect(prismaClient.userHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining(login),
      })
    })

    it('POST /auth/logout: Success', async () => {
      const logout: Prisma.UserHistoryUncheckedCreateInput = {
        userId,
        action: UserAction.LOGOUT,
        details: { deviceId },
        deviceId,
      }
      await userService.createUserHistory(logout)
      expect(prismaClient.userHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining(logout),
      })
    })
  })

  // Common to user plan endpoints
  const planSelect = {
    id: faker.datatype.uuid(),
    transactionId: faker.datatype.uuid(),
    createdAt: new Date('2022-10-20'),
    expireAt: new Date('2022-10-20'),
    isActive: true,
    plan: {
      options: { fileNb: 5 },
      description: 'Desc',
      advantages: ['Advantages 1'],
      advantagesDescription: 'Advantages Desc',
    },
    planProduct: { externalId: faker.datatype.uuid() },
  }
  const planResult = {
    id: planSelect.id,
    externalId: planSelect.planProduct.externalId,
    transactionId: planSelect.transactionId,
    options: planSelect.plan.options,
    description: planSelect.plan.description,
    advantages: planSelect.plan.advantages,
    advantagesDescription: planSelect.plan.advantagesDescription,
    isActive: planSelect.isActive,
    createdAt: planSelect.createdAt,
    expireAt: planSelect.expireAt,
  }
  describe('GET /user/plan', () => {
    it('Returns user plan if the user id is provided', async () => {
      findMany.mockReturnValue(Promise.resolve([planSelect]))
      return userService.getUserPlan(userId).then((result) => {
        expect(result).toEqual(planResult)
      })
    })

    it('Throws an error if the user plan does not exist', async () => {
      findMany.mockReturnValue(Promise.resolve(null))
      return userService.getUserPlan(userId).catch((err) => {
        expect(err).toBeDefined()
      })
    })
  })

  describe('GET /user/plan/history', () => {
    it('Returns user plan history if the user id is provided', async () => {
      findMany.mockReturnValue(Promise.resolve([planSelect]))
      return userService.getUserPlans(userId).then((result) => {
        expect(result).toEqual([planResult])
      })
    })
  })
})
