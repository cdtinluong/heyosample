import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { CreateHttpHandlerWithAuthOptions } from '@layers/core/lib/http-handler'
import pick from 'lodash/pick'
import { MigrationStatus } from '@layers/prisma'
import { CustomCode } from '@layers/core/lib/code'
import { UserService } from './services'

export const patchUser: CreateHttpHandlerWithAuthOptions = {
  name: 'patchUser',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const user = await userService.getUser(id)

    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    if (user.deleteAt !== null) {
      return ctx.res.Unauthorized(
        JSON.stringify({ message: 'User is not active', code: CustomCode.USER_PENDING_DELETION }),
      )
    }

    const updatedUser = await userService.updateUser(id, {
      ...pick(event.params, ['name']),
      deviceId,
    })
    return ctx.res.Ok({ data: updatedUser, message: 'User updated', code: CustomCode.USER_UPDATED })
  },
}

export const deleteUser: CreateHttpHandlerWithAuthOptions = {
  name: 'deleteUser',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const { id } = event.meta.user

    const user = await userService.getUser(id)
    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    if (user.deleteAt !== null) {
      return ctx.res.BadRequest(
        JSON.stringify({ message: 'User is not active', code: CustomCode.USER_PENDING_DELETION }),
      )
    }

    await userService.deleteUser(id)
    return ctx.res.Ok({ message: 'User deleted', code: CustomCode.USER_DELETED, data: {} })
  },
}

export const getUser: CreateHttpHandlerWithAuthOptions = {
  name: 'getUser',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const user = await userService.getUser(event.meta.user.id)
    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    if (user.deleteAt !== null) {
      return ctx.res.Unauthorized(
        JSON.stringify({ message: 'User is not active', code: CustomCode.USER_PENDING_DELETION }),
      )
    }

    return ctx.res.Ok({ message: 'User retrieved', code: CustomCode.USER_RETRIEVED, data: user })
  },
}

export const postUserRecover: CreateHttpHandlerWithAuthOptions = {
  name: 'postUserRecover',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id } = event.meta.user
    const userService = new UserService(ctx.prisma)
    const user = await userService.getDeletedUser(id)

    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    await userService.updateUser(id, { deleteAt: null })
    return ctx.res.Ok({ message: 'User recovered', code: CustomCode.USER_RECOVERED, data: {} })
  },
}

export const getUserHistory: CreateHttpHandlerWithAuthOptions<{
  page: number
}> = {
  name: 'getUserHistory',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id } = event.meta.user
    const { page } = event.params
    const userService = new UserService(ctx.prisma)
    const user = await userService.getUser(id)
    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    if (user.deleteAt !== null) {
      return ctx.res.Unauthorized(
        JSON.stringify({ message: 'User is not active', code: CustomCode.USER_PENDING_DELETION }),
      )
    }

    return ctx.res.Ok({
      data: {
        histories: await userService.getUserHistory(id, page),
        user,
      },
      message: 'User history retrieved',
      code: CustomCode.USER_HISTORY_RETRIEVED,
    })
  },
}

export const patchUserMigration: CreateHttpHandlerWithAuthOptions<{ status: MigrationStatus }> = {
  name: 'patchUserMigration',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const { deviceId } = event.meta
    const { id } = event.meta.user

    await userService.updateUser(id, {
      migrationStatus: event.params.status,
      deviceId,
    })

    return ctx.res.Ok({ message: 'User migration updated', code: CustomCode.USER_MIGRATION_UPDATED, data: {} })
  },
}

export const getUserPlan: CreateHttpHandlerWithAuthOptions = {
  name: 'getUserPlan',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)

    const userPlan = await userService.getUserPlan(event.meta.user.id)
    if (!userPlan) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User plan not found', code: CustomCode.USER_PLAN_NOT_FOUND }))
    }

    return ctx.res.Ok({
      message: 'User Plan retrieved',
      code: CustomCode.USER_PLAN_RETRIEVED,
      data: userPlan,
    })
  },
}

export const getUserPlanHistory: CreateHttpHandlerWithAuthOptions = {
  name: 'getUserPlanHistory',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const userService = new UserService(ctx.prisma)
    const userPlans = await userService.getUserPlans(event.meta.user.id)

    return ctx.res.Ok({
      message: 'User Plan History retrieved',
      code: CustomCode.USER_PLAN_HISTORY_RETRIEVED,
      data: userPlans,
    })
  },
}
