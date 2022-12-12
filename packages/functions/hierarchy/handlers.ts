import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { CreateHttpHandlerWithAuthOptions } from 'packages/layers/core/nodejs/lib/http-handler'
import { normalizePath } from 'file/utils'
import isEmpty from 'lodash/isEmpty'
import pick from 'lodash/pick'
import { UserService } from 'user/services'
import { FileService } from 'file/services'
import { CustomCode } from '@layers/core/lib/code'
import { HierarchyService } from './services'
import { BatchHierarchyItem } from './models'
import { associateFileThumbnail, validateFileSize } from './utils'

export const postHierarchy: CreateHttpHandlerWithAuthOptions<{
  folder: string
  file: { name: string; size: string; type: string }
}> = {
  name: 'postHierarchy',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const { folder, file } = event.params

    if (file != null) {
      if (file.type === 'preset' && folder !== '/') {
        return ctx.res.Forbidden(
          JSON.stringify({ message: 'Must create preset in root folder', code: CustomCode.PRESET_CREATE_FAILED }),
        )
      }

      if (validateFileSize(file.size)) {
        return ctx.res.BadRequest(JSON.stringify({ message: 'File size invalid', code: CustomCode.FILE_SIZE_INVALID }))
      }
    }

    const hierarchyService = new HierarchyService(ctx.prisma)
    const userService = new UserService(ctx.prisma)
    const user = await userService.getUserWithOrg(id)
    if (user === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }
    const { withSlash, withoutSlash } = normalizePath(folder)

    const pathWithSlash = isEmpty(file) ? withSlash : `${withSlash}${file.name}`
    const pathWithoutSlash = isEmpty(file) ? withoutSlash : `${withSlash}${file.name}`

    const existingHierarchy = await hierarchyService.getHierarchyByPath(id, pathWithSlash)
    if (existingHierarchy !== null) {
      return ctx.res.Conflict(JSON.stringify({ message: 'Duplicated name', code: CustomCode.HIERARCHY_DUPLICATED }))
    }

    const isValidPaths = await hierarchyService.isValidHierarchy(id, pathWithoutSlash)
    if (!isValidPaths) {
      return ctx.res.BadRequest(
        JSON.stringify({ message: 'Parent hierarchy not found', code: CustomCode.HIERARCHY_PARENT_NOT_FOUND }),
      )
    }

    // Create folder
    if (isEmpty(file)) {
      const createdFolder = await hierarchyService.createHierarchy(id, withSlash, deviceId)
      return ctx.res.body(201, {
        data: createdFolder,
        message: 'Hierarchy created',
        code: CustomCode.HIERARCHY_CREATED,
      })
    }

    const fileService = new FileService(ctx.prisma)
    const createdFile = await fileService.createFile(
      id,
      user.organizations[0].organizationId,
      withSlash,
      file.name,
      file.size,
      file.type,
      deviceId,
    )

    return ctx.res.body(201, {
      data: pick(createdFile.hierarchy, ['id', 'fileId', 'path']),
      message: 'Hierarchy created',
      code: CustomCode.HIERARCHY_CREATED,
    })
  },
}

export const patchHierarchy: CreateHttpHandlerWithAuthOptions<{
  oldPath: string
  newPath: string
}> = {
  name: 'patchHierarchy',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id } = event.meta.user
    const { oldPath, newPath } = event.params
    const { deviceId } = event.meta

    const hierarchyService = new HierarchyService(ctx.prisma)
    const userService = new UserService(ctx.prisma)
    const user = await userService.getUser(id)
    if (user === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    const [findHierarchy, checkDuplicatedHierarchy] = await Promise.all([
      hierarchyService.getHierarchyByPath(id, oldPath),
      hierarchyService.getHierarchyByPath(id, newPath),
    ])
    if (findHierarchy === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'Hierarchy not found', code: CustomCode.HIERARCHY_NOT_FOUND }))
    }
    // Check duplicate
    if (checkDuplicatedHierarchy !== null) {
      return ctx.res.Conflict(JSON.stringify({ message: 'Duplicated name', code: CustomCode.HIERARCHY_DUPLICATED }))
    }

    const regexFileName = /[^\\/]+\.(vectornator|animator){1}$/

    const isUpdateFile = findHierarchy.fileId !== null
    const hierarchies = await hierarchyService.updatePathHierarchy(id, newPath, oldPath, isUpdateFile, deviceId)
    if (hierarchies.length === 0) {
      return ctx.res.Conflict(
        JSON.stringify({ message: 'Hierarchy requires synchronization', code: CustomCode.HIERARCHY_REQUIRES_SYNC }),
      )
    }
    // Valid file name
    if (isUpdateFile) {
      const resultRegexNewFileName = regexFileName.exec(newPath)
      if (resultRegexNewFileName === null || isEmpty(resultRegexNewFileName.at(0))) {
        return ctx.res.BadRequest(
          JSON.stringify({ message: 'Filename can not empty', code: CustomCode.FILE_NAME_INVALID }),
        )
      }

      await hierarchyService.renameFile(
        findHierarchy.fileId as string,
        resultRegexNewFileName.at(0) as string,
        deviceId,
      )
    }
    return ctx.res.Ok({
      data: hierarchies as [],
      message: 'Hierarchy updated',
      code: CustomCode.HIERARCHY_RENAMED,
    })
  },
}

export const getHierarchyListOwner: CreateHttpHandlerWithAuthOptions<{ hierarchyId?: string }> = {
  name: 'getHierarchyListOwner',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id } = event.meta.user
    const { hierarchyId } = event.params
    const hierarchyService = new HierarchyService(ctx.prisma)
    const userService = new UserService(ctx.prisma)
    const user = await userService.getUser(id)
    if (user === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }
    let startFromPath

    if (hierarchyId !== null && hierarchyId !== undefined) {
      const hierarchy = await hierarchyService.getHierarchyById(hierarchyId, id)
      if (hierarchy === null) {
        return ctx.res.NotFound(
          JSON.stringify({ message: 'Hierarchy not found', code: CustomCode.HIERARCHY_NOT_FOUND }),
        )
      }
      startFromPath = hierarchy.path
    }

    const userHierarchies = await hierarchyService.getUserHierarchies(event.meta.user.id, false, startFromPath)
    const { hierarchies } = hierarchyService.getHierarchyTreeAndFiles(userHierarchies)
    const fileService = new FileService(ctx.prisma)
    await associateFileThumbnail(fileService, id, hierarchies)

    return ctx.res.Ok({
      data: hierarchies,
      message: 'Hierarchy owner list retrieved',
      code: CustomCode.HIERARCHY_LIST_OWNER_RETRIEVED,
    })
  },
}

export const getHierarchyListShared: CreateHttpHandlerWithAuthOptions<{ hierarchyId?: string }> = {
  name: 'getHierarchyListShared',
  withDb: true,
  isReadOnly: true,
  // eslint-disable-next-line @typescript-eslint/require-await
  async handler(_event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    return ctx.res.Ok({
      data: [],
      message: 'Hierarchy shared list retrieved',
      code: CustomCode.HIERARCHY_LIST_SHARED_RETRIEVED,
    })
  },
}

export const getHierarchyListTrashed: CreateHttpHandlerWithAuthOptions = {
  name: 'getHierarchyListTrashed',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const hierarchyService = new HierarchyService(ctx.prisma)
    const userHierarchies = await hierarchyService.getUserHierarchies(event.meta.user.id, true)
    const { hierarchies, files } = hierarchyService.getHierarchyTreeAndFiles(userHierarchies)
    const fileService = new FileService(ctx.prisma)
    await associateFileThumbnail(fileService, event.meta.user.id, hierarchies)

    return ctx.res.Ok({
      data: {
        hierarchies,
        files,
      },
      message: 'Hierarchy trashed list retrieved',
      code: CustomCode.HIERARCHY_LIST_TRASHED_RETRIEVED,
    })
  },
}

export const deleteHierarchy: CreateHttpHandlerWithAuthOptions<{ hierarchyId: string }> = {
  name: 'deleteHierarchy',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const hierarchyService = new HierarchyService(ctx.prisma)
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const { hierarchyId } = event.params

    let hierarchy = await hierarchyService.getHierarchyById(hierarchyId, id)
    if (hierarchy === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'Hierarchy not found', code: CustomCode.HIERARCHY_NOT_FOUND }))
    }
    hierarchy = await hierarchyService.changeDuplicatedNameDeleteFlow(hierarchy, id, deviceId)
    const hierarchies = await hierarchyService.deleteFile(hierarchy, id, deviceId)
    return ctx.res.Ok({ data: hierarchies, message: 'Hierarchy deleted', code: CustomCode.HIERARCHY_DELETED })
  },
}

export const postHierarchyRecover: CreateHttpHandlerWithAuthOptions<{ hierarchyId: string }> = {
  name: 'postHierarchyRecover',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const { hierarchyId } = event.params
    const hierarchyService = new HierarchyService(ctx.prisma)
    const userService = new UserService(ctx.prisma)
    const user = await userService.getUser(id)
    if (user === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }
    const hierarchy = await hierarchyService.getHierarchyTrashedById(hierarchyId, id)
    if (hierarchy === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'Hierarchy not found', code: CustomCode.HIERARCHY_NOT_FOUND }))
    }

    const existingHierarchy = await hierarchyService.getHierarchyByPath(id, hierarchy.path)
    if (existingHierarchy !== null) {
      return ctx.res.Conflict(
        JSON.stringify({
          message: 'Hierarchy already exists and cannot be recovered',
          code: CustomCode.HIERARCHY_DUPLICATED,
        }),
      )
    }

    if ((await hierarchyService.isValidHierarchy(id, normalizePath(hierarchy.path).withoutSlash)) === false) {
      return ctx.res.BadRequest(
        JSON.stringify({
          message: 'The parent folder was deleted preventing the recovering to happen',
          code: CustomCode.HIERARCHY_PARENT_NOT_FOUND,
        }),
      )
    }

    const hierarchies = await hierarchyService.recoverHierarchy(hierarchy, id, deviceId)
    return ctx.res.Ok({ data: hierarchies, message: 'Hierarchy recovered', code: CustomCode.HIERARCHY_RECOVERED })
  },
}

export const deleteHierarchyPermanently: CreateHttpHandlerWithAuthOptions<{ hierarchyId: string }> = {
  name: 'deleteHierarchyPermanently',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const hierarchyService = new HierarchyService(ctx.prisma)
    const { id } = event.meta.user
    const { deviceId } = event.meta
    const { hierarchyId } = event.params

    const hierarchy = await hierarchyService.getHierarchyTrashedById(hierarchyId, id)
    if (hierarchy === null) {
      return ctx.res.NotFound(JSON.stringify({ message: 'Hierarchy not found', code: CustomCode.HIERARCHY_NOT_FOUND }))
    }

    const hierarchies = await hierarchyService.deleteFile(hierarchy, id, deviceId, true)
    return ctx.res.Ok({
      data: hierarchies,
      message: 'Hierarchy permanently deleted',
      code: CustomCode.HIERARCHY_PERMANENTLY_DELETED,
    })
  },
}

export const postHierarchyBatch: CreateHttpHandlerWithAuthOptions<{ paths: BatchHierarchyItem[] }> = {
  name: 'postHierarchyBatch',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { paths } = event.params
    const invalidPath = paths.some((path) => path.type === 'preset' && (path.name.match(/\//g) || []).length > 1)

    if (invalidPath) {
      return ctx.res.Forbidden(
        JSON.stringify({ message: 'Must create preset in root folder', code: CustomCode.PRESET_CREATE_FAILED }),
      )
    }

    const invalidFileSize = paths.some((file) => validateFileSize(file.size))

    if (invalidFileSize) {
      return ctx.res.BadRequest(JSON.stringify({ message: 'File size invalid', code: CustomCode.FILE_SIZE_INVALID }))
    }

    const {
      deviceId,
      user: { id },
    } = event.meta

    const userService = new UserService(ctx.prisma)
    const user = await userService.getUserWithOrg(id)

    if (!user) {
      return ctx.res.NotFound(JSON.stringify({ message: 'User not found', code: CustomCode.USER_NOT_FOUND }))
    }

    const hierarchyService = new HierarchyService(ctx.prisma)
    await hierarchyService.createBatchHierarchy(id, deviceId, user.organizations[0].organizationId, paths)
    const userHierarchies = await hierarchyService.getUserHierarchies(id, false, undefined)
    const { hierarchies } = hierarchyService.getHierarchyTreeAndFiles(userHierarchies)

    return ctx.res.Ok({
      data: hierarchies,
      message: 'Hierarchies created',
      code: CustomCode.HIERARCHY_BATCH_CREATED,
    })
  },
}

export const getPresetList: CreateHttpHandlerWithAuthOptions = {
  name: 'getPresetList',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const hierarchyService = new HierarchyService(ctx.prisma)
    const userPresets = await hierarchyService.getUserHierarchies(event.meta.user.id, false, undefined, 'preset')
    const { hierarchies } = hierarchyService.getHierarchyTreeAndFiles(userPresets)

    return ctx.res.Ok({
      data: hierarchies,
      message: 'Hierarchy preset list retrieved',
      code: CustomCode.PRESET_LIST_RETRIEVED,
    })
  },
}
