import { faker } from '@faker-js/faker'
import { Response } from '@layers/core/lib/response'
import { MigrationStatus } from '@layers/prisma'
import { UserService } from '../services'
import { CustomCode } from '@layers/core/lib/code'

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
}

const deviceId = faker.datatype.uuid()
const ctx: any = { res: new Response() }
const event: any = {
  meta: {
    user: { id: faker.datatype.uuid(), email: 'test@test.com', given_name: faker.name, family_name: faker.name },
    deviceId,
  },
}

const userService = Object.getPrototypeOf(new UserService(prismaClient))
const updateUserSpy = jest.spyOn(userService, 'updateUser')
const getUserSpy = jest.spyOn(userService, 'getUser')
const deleteUserSpy = jest.spyOn(userService, 'deleteUser')
const getUserHistorySpy = jest.spyOn(userService, 'getUserHistory')
const getUserPlanSpy = jest.spyOn(userService, 'getUserPlan')
const getUserPlansSpy = jest.spyOn(userService, 'getUserPlans')
const getDeletedUserSpy = jest.spyOn(userService, 'getDeletedUser')

describe('user/handlers.ts', () => {
  const user = {
    id: event.meta.user.id,
    email: faker.internet.email(),
    name: faker.name.fullName(),
    isActive: true,
    deleteAt: null,
    migrationStatus: MigrationStatus.ONGOING,
  }

  describe('PATCH /user', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getUserSpy.mockResolvedValue(undefined)

      const { patchUser } = await import('../handlers')
      const res = await patchUser.handler(
        {
          ...event,
          params: { name: user.name },
        } as any,
        ctx,
      )
      expect(res.statusCode).toEqual(404)
      expect(updateUserSpy).not.toHaveBeenCalled()
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Returns 401: User in deleting mode', async () => {
      const userDeleteAt = {
        ...user,
        deleteAt: new Date(),
      }
      getUserSpy.mockResolvedValue(userDeleteAt)
      updateUserSpy.mockResolvedValue(userDeleteAt)

      const { patchUser } = await import('../handlers')
      const res = await patchUser.handler(
        {
          ...event,
          params: { name: userDeleteAt.name },
        } as any,
        ctx,
      )
      expect(res.statusCode).toEqual(401)
      expect(updateUserSpy).not.toHaveBeenCalled()
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PENDING_DELETION)
    })

    it('Returns 200: User updated', async () => {
      getUserSpy.mockResolvedValue(user)
      updateUserSpy.mockResolvedValue(user)

      const { patchUser } = await import('../handlers')
      const res = await patchUser.handler(
        {
          ...event,
          params: { name: user.name },
        } as any,
        ctx,
      )
      expect(res.statusCode).toEqual(200)
      expect(updateUserSpy).toHaveBeenCalledWith(user.id, { name: user.name, deviceId })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_UPDATED)
      expect(JSON.parse(String(res.body)).data).toEqual(user)
    })
  })

  describe('DELETE /user', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getUserSpy.mockResolvedValue(undefined)
      const { deleteUser } = await import('../handlers')
      const res = await deleteUser.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Returns 400: User already deleted', async () => {
      getUserSpy.mockResolvedValue({ deleteAt: new Date() })
      const { deleteUser } = await import('../handlers')
      const res = await deleteUser.handler(event, ctx)
      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PENDING_DELETION)
    })

    it('Returns 200: User found', async () => {
      getUserSpy.mockResolvedValue({ deleteAt: null })
      deleteUserSpy.mockResolvedValue({ deleteAt: new Date() })

      const { deleteUser } = await import('../handlers')
      const res = await deleteUser.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_DELETED)
    })
  })

  describe('GET /user', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getUserSpy.mockResolvedValue(undefined)
      const { getUser } = await import('../handlers')
      const res = await getUser.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(getUserSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Returns 401: User in deleting mode', async () => {
      getUserSpy.mockResolvedValue({
        ...user,
        deleteAt: new Date(),
      })

      const { getUser } = await import('../handlers')
      const res = await getUser.handler(event, ctx)
      expect(res.statusCode).toEqual(401)
      expect(getUserSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PENDING_DELETION)
    })

    it('Returns 200: User found', async () => {
      getUserSpy.mockResolvedValue(user)

      const { getUser } = await import('../handlers')
      const res = await getUser.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(getUserSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_RETRIEVED)
      expect(JSON.parse(String(res.body)).data).toEqual(user)
    })
  })

  describe('POST /user/recover', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getDeletedUserSpy.mockResolvedValue(undefined)
      const { postUserRecover } = await import('../handlers')
      const res = await postUserRecover.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Returns 200: User found', async () => {
      getDeletedUserSpy.mockResolvedValue({ deleteAt: new Date() })
      updateUserSpy.mockResolvedValue({ deleteAt: null })

      const { postUserRecover } = await import('../handlers')
      const res = await postUserRecover.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_RECOVERED)
    })
  })

  describe('GET /user/history', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User not found', async () => {
      getUserSpy.mockResolvedValue(undefined)
      const { getUserHistory } = await import('../handlers')
      const res = await getUserHistory.handler(
        {
          ...event,
          params: { page: 1 },
        },
        ctx,
      )
      expect(res.statusCode).toEqual(404)
      expect(getUserSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Returns 401: User in deleting mode', async () => {
      getUserSpy.mockResolvedValue({
        ...user,
        deleteAt: new Date(),
      })

      const { getUserHistory } = await import('../handlers')
      const res = await getUserHistory.handler(
        {
          ...event,
          params: { page: 1 },
        },
        ctx,
      )
      expect(res.statusCode).toEqual(401)
      expect(getUserSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PENDING_DELETION)
    })

    it('Returns 200: User History found', async () => {
      getUserSpy.mockResolvedValue(user)
      const histories = [
        {
          id: faker.datatype.uuid(),
          user_id: user.id,
          action: 'LOGIN',
          details: {
            device_id: 'unit-test',
          },
          createdAt: new Date().toString(),
        },
      ]
      getUserHistorySpy.mockResolvedValue(histories)

      const { getUserHistory } = await import('../handlers')
      const res = await getUserHistory.handler(
        {
          ...event,
          params: { page: 1 },
        },
        ctx,
      )
      expect(res.statusCode).toEqual(200)
      expect(getUserSpy).toHaveBeenCalledWith(user.id)
      expect(getUserHistorySpy).toHaveBeenCalledWith(user.id, 1)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_HISTORY_RETRIEVED)
      expect(JSON.parse(String(res.body)).data.user).toEqual(user)
      expect(JSON.parse(String(res.body)).data.histories).toEqual(histories)
    })
  })

  describe('PATCH /user/migration', () => {
    it('return 200: should update user migration status successfully', async () => {
      updateUserSpy.mockReset().mockResolvedValue(user)

      const { patchUserMigration } = await import('../handlers')
      const resp = await patchUserMigration.handler({ ...event, params: { status: MigrationStatus.ONGOING } }, ctx)

      expect(resp.statusCode).toEqual(200)
      expect(JSON.parse(String(resp.body)).code).toEqual(CustomCode.USER_MIGRATION_UPDATED)
    })
  })

  // Commong to user plan
  const plan = {
    id: faker.datatype.uuid(),
    transactionId: faker.datatype.uuid(),
    createdAt: new Date('2022-10-20'),
    expireAt: new Date('2022-10-20'),
    isActive: true,
    options: { fileNb: 5 },
    description: 'Desc',
    advantages: ['Advantages 1'],
    advantagesDescription: 'Advantages Desc',
    externalId: faker.datatype.uuid(),
  }
  describe('GET /user/plan', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: User plan not found', async () => {
      getUserPlanSpy.mockResolvedValue(null)

      const { getUserPlan } = await import('../handlers')
      const res = await getUserPlan.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(getUserPlanSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PLAN_NOT_FOUND)
    })

    it('Returns 200: User plan found', async () => {
      getUserPlanSpy.mockResolvedValue(plan)

      const { getUserPlan } = await import('../handlers')
      const res = await getUserPlan.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(getUserPlanSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PLAN_RETRIEVED)
    })
  })

  describe('GET /user/plan/history', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 200: User plan history found', async () => {
      getUserPlansSpy.mockResolvedValue([plan])

      const { getUserPlanHistory } = await import('../handlers')
      const res = await getUserPlanHistory.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(getUserPlansSpy).toHaveBeenCalledWith(user.id)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_PLAN_HISTORY_RETRIEVED)
    })
  })
})
