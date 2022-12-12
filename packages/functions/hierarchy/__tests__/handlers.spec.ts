import { faker } from '@faker-js/faker'
import { Response } from '@layers/core/lib/response'
import { FileService } from 'file/services'
import { HierarchyService } from '../services'
import { CustomCode } from '@layers/core/lib/code'
import { UserService } from 'user/services'
import { MigrationStatus, FileType } from '@layers/prisma'
import * as utils from '../utils'

const findFirst = jest.fn()
const create = jest.fn()
const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  user: {
    findFirst,
  },
  file: {
    create,
  },
}

const ctx: any = {
  res: new Response(),
  prisma: prismaClient,
}
const hierarchyService = Object.getPrototypeOf(new HierarchyService(prismaClient))
const userService = Object.getPrototypeOf(new UserService(prismaClient))
const fileService = Object.getPrototypeOf(new FileService(prismaClient))
const createHierarchySpy = jest.spyOn(hierarchyService, 'createHierarchy')
const createFileSpy = jest.spyOn(fileService, 'createFile')
const isValidHierarchySpy = jest.spyOn(hierarchyService, 'isValidHierarchy')
const getHierarchyByPathSpy = jest.spyOn(hierarchyService, 'getHierarchyByPath')
const updatePathHierarchySpy = jest.spyOn(hierarchyService, 'updatePathHierarchy')
const renameFileSpy = jest.spyOn(hierarchyService, 'renameFile')
const getHierarchyByIdSpy = jest.spyOn(hierarchyService, 'getHierarchyById')
const getHierarchyTrashedByIdSpy = jest.spyOn(hierarchyService, 'getHierarchyTrashedById')
const getUserHierarchiesSpy = jest.spyOn(hierarchyService, 'getUserHierarchies')
const deleteFileSpy = jest.spyOn(hierarchyService, 'deleteFile')
const recoverHierarchySpy = jest.spyOn(hierarchyService, 'recoverHierarchy')
const createBatchHierarchySpy = jest.spyOn(hierarchyService, 'createBatchHierarchy')
const getUserWithOrgSpy = jest.spyOn(userService, 'getUserWithOrg')
const getUserSpy = jest.spyOn(userService, 'getUser')
const associateFileThumbnailSpy = jest.spyOn(utils, 'associateFileThumbnail')
const changeDuplicatedNameDeleteFlowSpy = jest.spyOn(hierarchyService, 'changeDuplicatedNameDeleteFlow')

const deviceId = faker.datatype.uuid()
const userId = faker.datatype.uuid()
const hierarchyId = faker.datatype.uuid()
const pathRoot = '/root/'
const subFolders = ['/root/sub-1/', '/root/sub-2/', '/root/sub-1/sub-1-1/', '/root/sub-2/sub-2-1/']
const files = [
  { id: faker.datatype.uuid(), filename: 'file_1.vectornator', size: faker.datatype.bigInt() },
  { id: faker.datatype.uuid(), filename: 'file_2.animator', size: faker.datatype.bigInt() },
]
const meta = { user: { id: userId }, deviceId }
const event: any = {
  meta,
}
describe('hierarchy/handlers', () => {
  describe('POST /hierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    event.params = { folder: pathRoot }

    it('Should create folder successfully', async () => {
      const createdFolder = { path: 'abc/xyz/', id: faker.datatype.uuid() }
      createHierarchySpy.mockResolvedValueOnce(createdFolder)
      getHierarchyByPathSpy.mockResolvedValue(null)
      isValidHierarchySpy.mockResolvedValueOnce(true)

      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(201)
      expect(JSON.parse(String(res.body)).data).toEqual(createdFolder)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_CREATED)
    })

    it('Should create folder failed - parent folder does not exists', async () => {
      getHierarchyByPathSpy.mockResolvedValue(null)
      isValidHierarchySpy.mockResolvedValueOnce(false)

      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_PARENT_NOT_FOUND)
    })

    it('Should create folder failed - folder already exists', async () => {
      getHierarchyByPathSpy.mockResolvedValue({})

      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(409)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_DUPLICATED)
    })

    it('Should create file successfully', async () => {
      getHierarchyByPathSpy.mockResolvedValue(null)
      const createdFolder = {
        id: faker.datatype.uuid(),
        fileId: faker.datatype.uuid(),
        path: `${pathRoot}${files[0].filename}`,
      }
      findFirst.mockResolvedValueOnce({
        id: faker.datatype.uuid(),
        organizations: [{ organizationId: faker.datatype.uuid() }],
      })
      createFileSpy.mockResolvedValueOnce({ hierarchy: createdFolder })
      isValidHierarchySpy.mockResolvedValueOnce(true)

      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(201)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_CREATED)
    })

    it('Should create file failed - folder does not exists', async () => {
      getHierarchyByPathSpy.mockResolvedValue(null)
      isValidHierarchySpy.mockReset().mockResolvedValueOnce(false)

      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_PARENT_NOT_FOUND)
    })

    it('should create folder failed - user does not exists', async () => {
      getUserWithOrgSpy.mockResolvedValue(null)

      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('should create preset failed - not create preset in root hierarchy', async () => {
      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(
        {
          ...event,
          params: { folder: '/abc/', file: { name: 'file.vectornator', type: 'preset' } },
        },
        ctx,
      )

      expect(res.statusCode).toEqual(403)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PRESET_CREATE_FAILED)
    })

    it('should create file failed - file size less than 1', async () => {
      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(
        {
          ...event,
          params: { folder: '/abc/', file: { name: 'file.vectornator', size: '0', type: 'vectornator' } },
        },
        ctx,
      )

      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_SIZE_INVALID)
    })

    it('should create file failed - file size greater than max bigint value', async () => {
      const { postHierarchy } = await import('../handlers')
      const res = await postHierarchy.handler(
        {
          ...event,
          params: { folder: '/abc/', file: { name: 'file.vectornator', size: '9223372036854775808', type: 'vectornator' } },
        },
        ctx,
      )

      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_SIZE_INVALID)
    })
  })

  describe('PATCH /hierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })
    const renameFolder = {
      oldPath: subFolders[0],
      newPath: subFolders[1],
    }
    const renameFileRequest = {
      oldPath: `${subFolders[0]}/${files[0].filename}`,
      newPath: `${subFolders[0]}/${files[1].filename}`,
    }
    const hierarchies = [
      {
        id: faker.datatype.uuid(),
        path: renameFolder.newPath,
      },
    ]

    it('Return 404: user not found', async () => {
      getUserSpy.mockResolvedValue(null)

      const { patchHierarchy } = await import('../handlers')
      const res = await patchHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Return 409: hierarchy requires synchronization', async () => {
      getUserSpy.mockResolvedValue({})
      updatePathHierarchySpy.mockResolvedValue([])
      getHierarchyByPathSpy.mockResolvedValueOnce({}).mockResolvedValue(null)

      const { patchHierarchy } = await import('../handlers')
      const res = await patchHierarchy.handler(event, ctx)

      expect(res.statusCode).toEqual(409)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_REQUIRES_SYNC)
    })

    it('Returns 404: Not found', async () => {
      event.params = renameFolder
      const { patchHierarchy } = await import('../handlers')
      getHierarchyByPathSpy.mockResolvedValueOnce(null)
      const res = await patchHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_NOT_FOUND)
    })

    it('Returns 409: Duplicated name', async () => {
      const { patchHierarchy } = await import('../handlers')
      getHierarchyByPathSpy
        .mockResolvedValueOnce({ id: faker.datatype.uuid(), path: renameFolder.oldPath })
        .mockResolvedValueOnce({ id: faker.datatype.uuid(), path: renameFolder.newPath })
      const res = await patchHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(409)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_DUPLICATED)
    })

    it('Returns 400: File name can not empty', async () => {
      const { patchHierarchy } = await import('../handlers')
      getHierarchyByPathSpy
        .mockResolvedValueOnce({
          id: faker.datatype.uuid(),
          path: renameFileRequest.oldPath,
          fileId: faker.datatype.uuid(),
        })
        .mockResolvedValueOnce(null)
      updatePathHierarchySpy.mockResolvedValueOnce(hierarchies)
      renameFolder.newPath = ''
      event.params = renameFolder
      const res = await patchHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_NAME_INVALID)
    })

    it('Returns 200: rename folder successfully', async () => {
      const { patchHierarchy } = await import('../handlers')
      renameFolder.newPath = subFolders[1]
      event.params = renameFolder
      getHierarchyByPathSpy
        .mockResolvedValueOnce({
          id: faker.datatype.uuid(),
          path: renameFolder.oldPath,
          fileId: null,
        })
        .mockResolvedValueOnce(null)
      updatePathHierarchySpy.mockResolvedValueOnce(hierarchies)
      const res = await patchHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_RENAMED)
      expect(JSON.parse(String(res.body)).data).toEqual(hierarchies)
    })

    it('Returns 200: rename file successfully', async () => {
      const { patchHierarchy } = await import('../handlers')
      getHierarchyByPathSpy
        .mockResolvedValueOnce({
          id: faker.datatype.uuid(),
          path: renameFileRequest.oldPath,
          fileId: faker.datatype.uuid(),
        })
        .mockResolvedValueOnce(null)
      renameFileSpy.mockResolvedValueOnce({ id: faker.datatype.uuid() })
      updatePathHierarchySpy.mockResolvedValueOnce(hierarchies)
      event.params = renameFileRequest
      const res = await patchHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_RENAMED)
      expect(JSON.parse(String(res.body)).data).toEqual(hierarchies)
    })
  })

  describe('GET /hierarchy/list/owner', () => {
    it('should get all hierarchy tree successfully', async () => {
      event.params = { hierarchyId }
      const hierarchy = { id: hierarchyId, path: 'abc/' }
      const userHierarchies = [
        {
          id: faker.datatype.uuid(),
          path: 'abc/',
          deleteAt: null,
          file: null,
        },
      ]
      const hierarchyTree = [
        {
          id: userHierarchies[0].id,
          path: 'abc/',
          files: [],
          children: [],
          deleteAt: null,
        },
      ]
      getHierarchyByIdSpy.mockReset().mockResolvedValueOnce(hierarchy)
      getUserHierarchiesSpy.mockReset().mockResolvedValueOnce(userHierarchies)

      const { getHierarchyListOwner } = await import('../handlers')
      const res = await getHierarchyListOwner.handler(event, ctx)

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(String(res.body)).data).toEqual(hierarchyTree)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_LIST_OWNER_RETRIEVED)
      expect(associateFileThumbnailSpy).toBeCalledWith(expect.any(FileService), event.meta.user.id, hierarchyTree)
    })

    it('should return 404 since hierarchyId does not exists', async () => {
      getHierarchyByIdSpy.mockReset().mockResolvedValueOnce(Promise.resolve(null))

      const { getHierarchyListOwner } = await import('../handlers')
      const res = await getHierarchyListOwner.handler(event, ctx)

      expect(res.statusCode).toBe(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_NOT_FOUND)
    })

    it('Return 404: user not found', async () => {
      getUserSpy.mockResolvedValue(null)

      const { getHierarchyListOwner } = await import('../handlers')
      const res = await getHierarchyListOwner.handler(event, ctx)

      expect(res.statusCode).toBe(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })
  })

  describe('GET hierarchy/list/shared', () => {
    it('Return 200', async () => {
      event.params = { hierarchyId }
      const { getHierarchyListShared } = await import('../handlers')
      const res = await getHierarchyListShared.handler(event, ctx)

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(String(res.body)).data).toEqual([])
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_LIST_SHARED_RETRIEVED)
    })
  })

  describe('GET hierarchy/list/trash', () => {
    it('Return 200 - get trashed files and folders successfully', async () => {
      delete event.params
      const userHierarchies = [
        {
          id: faker.datatype.uuid(),
          path: pathRoot,
          deleteAt: new Date(),
          file: {
            id: faker.datatype.uuid(),
            name: files[0].filename,
            thumbnail: null,
          },
        },
      ]
      getUserHierarchiesSpy.mockReset().mockResolvedValueOnce(userHierarchies)

      const { getHierarchyListTrashed } = await import('../handlers')
      const res = await getHierarchyListTrashed.handler(event, ctx)

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_LIST_TRASHED_RETRIEVED)
    })
  })

  describe('DELETE /hierarchy/{hierarchyId}', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })
    const hierarchies = [
      {
        id: hierarchyId,
        path: pathRoot,
      },
    ]
    it('Returns 404: Not found', async () => {
      event.params = { hierarchyId }
      getHierarchyByIdSpy.mockResolvedValueOnce(null)
      deleteFileSpy.mockResolvedValue(null)
      const { deleteHierarchy } = await import('../handlers')
      const res = await deleteHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_NOT_FOUND)
    })

    it('Returns 200: Delete hierarchy successfully', async () => {
      getHierarchyByIdSpy.mockResolvedValueOnce({ id: hierarchyId, path: pathRoot })
      changeDuplicatedNameDeleteFlowSpy.mockResolvedValueOnce({ id: hierarchyId, path: pathRoot })
      deleteFileSpy.mockResolvedValue(hierarchies)
      const { deleteHierarchy } = await import('../handlers')
      const res = await deleteHierarchy.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual(hierarchies)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_DELETED)
    })
  })

  describe('POST /hierarchy/{hierarchyId}/recover', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Returns 404: Not found', async () => {
      event.params = {
        hierarchyId,
        deviceId,
      }
      getHierarchyTrashedByIdSpy.mockResolvedValueOnce(null)
      const { postHierarchyRecover } = await import('../handlers')
      const res = await postHierarchyRecover.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_NOT_FOUND)
    })

    it('Returns 404: User Not found', async () => {
      event.params = {
        hierarchyId,
        deviceId,
      }
      getUserSpy.mockResolvedValueOnce(null)

      const { postHierarchyRecover } = await import('../handlers')
      const res = await postHierarchyRecover.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Returns 409: Conflict', async () => {
      getHierarchyTrashedByIdSpy.mockResolvedValueOnce({
        id: hierarchyId,
        userId,
      })
      getHierarchyByPathSpy.mockResolvedValueOnce({
        id: hierarchyId,
        path: '/test',
        fileId: null,
      })
      const { postHierarchyRecover } = await import('../handlers')
      const res = await postHierarchyRecover.handler(event, ctx)
      expect(res.statusCode).toEqual(409)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_DUPLICATED)
    })

    it('Returns 400: Parent hierarchy deleted', async () => {
      getHierarchyTrashedByIdSpy.mockResolvedValueOnce({
        id: hierarchyId,
        userId,
        path: '/test',
      })
      getHierarchyByPathSpy.mockResolvedValueOnce(null)
      isValidHierarchySpy.mockResolvedValueOnce(false)
      const { postHierarchyRecover } = await import('../handlers')
      const res = await postHierarchyRecover.handler(event, ctx)
      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_PARENT_NOT_FOUND)
    })

    it('Returns 200: Recover successfully', async () => {
      getHierarchyTrashedByIdSpy.mockResolvedValueOnce({
        id: hierarchyId,
        userId,
        path: '/test',
      })
      getHierarchyByPathSpy.mockResolvedValueOnce(null)
      isValidHierarchySpy.mockResolvedValueOnce(true)

      const hierarchies = [
        {
          id: faker.datatype.uuid(),
          userId,
          path: '/test',
        },
      ]
      recoverHierarchySpy.mockResolvedValue(hierarchies)

      const { postHierarchyRecover } = await import('../handlers')
      const res = await postHierarchyRecover.handler(event, ctx)
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual(hierarchies)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_RECOVERED)
    })
  })

  describe('DELETE /hierarchy/{hierarchyId}/permanent', () => {
    it('Returns 404: Not found', async () => {
      event.params = { hierarchyId }
      getHierarchyTrashedByIdSpy.mockResolvedValueOnce(null)
      deleteFileSpy.mockResolvedValue(null)

      const { deleteHierarchyPermanently } = await import('../handlers')
      const res = await deleteHierarchyPermanently.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_NOT_FOUND)
    })

    it('Returns 200: Delete hierarchy successfully', async () => {
      getHierarchyTrashedByIdSpy.mockResolvedValueOnce({ id: hierarchyId, path: '/test' })
      deleteFileSpy.mockResolvedValue([hierarchyId])

      const { deleteHierarchyPermanently } = await import('../handlers')
      const res = await deleteHierarchyPermanently.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_PERMANENTLY_DELETED)
    })
  })

  describe('POST /hierarchy/batch', () => {
    const user = {
      id: event.meta.user.id,
      email: faker.internet.email(),
      name: faker.name.fullName(),
      isActive: true,
      deleteAt: null,
      migrationStatus: MigrationStatus.ONGOING,
      organizations: [
        {
          organizationId: faker.datatype.uuid(),
        },
      ],
    }
    it('Returns 200: Create batch hierarchy successfully', async () => {
      findFirst
        .mockReset()
        .mockResolvedValue({ id: faker.datatype.uuid(), organizations: [{ organizationId: faker.datatype.uuid() }] })
      const createdHierarchies: any = [
        { id: faker.datatype.uuid(), path: '/', deleteAt: null, file: null },
        { id: faker.datatype.uuid(), path: pathRoot, deleteAt: null, file: null },
        { id: faker.datatype.uuid(), path: subFolders[0], deleteAt: null, file: null },
      ]
      files.forEach((item) => {
        createdHierarchies.push({
          id: faker.datatype.uuid(),
          path: `${subFolders[0]}${item.filename}`,
          deleteAt: null,
          file: { id: faker.datatype.uuid(), name: item.filename, thumbnail: null },
        })
        return {
          filename: `${subFolders[0]}${item.filename}`,
          size: item.size,
        }
      })
      getUserWithOrgSpy.mockResolvedValue(user)
      event.params = { paths: [{ name: '/abc/file.vectornator', size: 5, type: 'vectornator' }] }

      createBatchHierarchySpy.mockReset().mockResolvedValue({})
      getUserHierarchiesSpy.mockReset().mockResolvedValue(createdHierarchies)
      const { postHierarchyBatch } = await import('../handlers')

      const res = await postHierarchyBatch.handler(event, ctx)

      const { data } = JSON.parse(res.body as string)
      const rootHierarchy = data[0].children[0]
      const subHierarchy = rootHierarchy.children[0]
      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.HIERARCHY_BATCH_CREATED)
      expect(data[0].children.length).toEqual(1)
      expect(rootHierarchy.id).toEqual(createdHierarchies[1].id)
      expect(subHierarchy.id).toEqual(createdHierarchies[2].id)
      expect(subHierarchy.files.length).toEqual(files.length)
    })

    it('Return 404: User does not exists', async () => {
      getUserWithOrgSpy.mockResolvedValueOnce(null)
      const { postHierarchyBatch } = await import('../handlers')
      const res = await postHierarchyBatch.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.USER_NOT_FOUND)
    })

    it('Return 403: invalid path for preset', async () => {
      const { postHierarchyBatch } = await import('../handlers')
      const res = await postHierarchyBatch.handler(
        {
          ...event,
          params: { paths: [{ name: '/abc/', size:'9223372036854775807', type: 'preset' }] },
        },
        ctx,
      )

      expect(res.statusCode).toEqual(403)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.PRESET_CREATE_FAILED)
    })

    it('should create batch hierarchy failed - file size is less than 1', async () => {
      const { postHierarchyBatch } = await import('../handlers')
      const res = await postHierarchyBatch.handler(
        {
          ...event,
          params: { paths: [{ name: '/abc/', size:'0', type: 'vectornator' }] },
        },
        ctx,
      )

      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_SIZE_INVALID)
    })

    it('should create batch hierarchy failed - file size is greater than max bigint value', async () => {
      const { postHierarchyBatch } = await import('../handlers')
      const res = await postHierarchyBatch.handler(
        {
          ...event,
          params: { paths: [{ name: '/abc/', size:'9223372036854775809', type: 'vectornator' }] },
        },
        ctx,
      )

      expect(res.statusCode).toEqual(400)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_SIZE_INVALID)
    })
  })

  describe('Create root and sub folders then delete root folder', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Should delete all child folder when delete parent folder', async () => {
      const { postHierarchy, deleteHierarchy } = await import('../handlers')
      const createdRootFolderResult = { path: pathRoot, id: hierarchyId }
      const createdSubFolderResult = { path: subFolders[0], id: faker.datatype.uuid() }
      createHierarchySpy.mockResolvedValueOnce(createdRootFolderResult).mockResolvedValueOnce(createdSubFolderResult)
      getHierarchyByPathSpy.mockResolvedValue(null)
      isValidHierarchySpy.mockResolvedValue(true)
      // Create root
      event.params = { folder: pathRoot }
      const resultRoot = await postHierarchy.handler(event, ctx)
      expect(resultRoot.statusCode).toEqual(201)
      // Create sub folder
      event.params = { folder: subFolders[0] }
      const resultSubFolder = await postHierarchy.handler(event, ctx)
      expect(resultSubFolder.statusCode).toEqual(201)

      // Delete root folder
      event.params = { hierarchyId }
      deleteFileSpy.mockResolvedValue(Promise.resolve([hierarchyId, createdSubFolderResult.id]))
      const resultDelete = await deleteHierarchy.handler(event, ctx)
      const body: any = JSON.parse(resultDelete.body as string)
      expect(resultDelete.statusCode).toEqual(200)
      expect(body.data.length).toEqual(2)
    })

    it('Should delete all file when delete folder', async () => {
      const { postHierarchy, deleteHierarchy } = await import('../handlers')
      getUserWithOrgSpy.mockResolvedValue({
        id: faker.datatype.uuid(),
        email: faker.internet.email(),
        name: faker.name.fullName(),
        isActive: true,
        deleteAt: null,
        organizations: [
          {
            organizationId: faker.datatype.uuid(),
          },
        ],
      })
      getHierarchyByPathSpy.mockResolvedValue(null)
      isValidHierarchySpy.mockResolvedValue(true)
      const createdRootFolderResult = { path: pathRoot, id: hierarchyId }
      createHierarchySpy.mockResolvedValueOnce(createdRootFolderResult)

      const createdFile = {
        id: faker.datatype.uuid(),
        fileId: faker.datatype.uuid(),
        path: `${pathRoot}${files[0].filename}`,
      }
      createFileSpy.mockResolvedValueOnce({ hierarchy: createdFile })
      // Create root
      event.params = { folder: pathRoot }
      const resultRoot = await postHierarchy.handler(event, ctx)
      expect(resultRoot.statusCode).toEqual(201)
      // Create file
      event.params = { folder: pathRoot, file: { name: `${pathRoot}${files[0].filename}`, size: '5' } }
      const resultFile = await postHierarchy.handler(event, ctx)
      expect(resultFile.statusCode).toEqual(201)

      // Delete root folder
      event.params = { hierarchyId }
      deleteFileSpy.mockResolvedValue(Promise.resolve([hierarchyId, createdFile.id]))
      const resultDelete = await deleteHierarchy.handler(event, ctx)
      const body: any = JSON.parse(resultDelete.body as string)
      expect(resultDelete.statusCode).toEqual(200)
      expect(body.data.length).toEqual(2)
    })
  })

  describe('Create folder, delete folder, create folder again', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })
    it('Should create folder successfully after delete folder', async () => {
      const { postHierarchy, deleteHierarchy } = await import('../handlers')
      isValidHierarchySpy.mockResolvedValue(true)
      getHierarchyByPathSpy.mockResolvedValue(null)

      // Create root
      const createdRootFolderResult = { path: pathRoot, id: hierarchyId }
      createHierarchySpy.mockResolvedValueOnce(createdRootFolderResult)
      event.params = { folder: pathRoot }
      let resultRoot = await postHierarchy.handler(event, ctx)
      expect(resultRoot.statusCode).toEqual(201)

      // Delete root folder
      event.params = { hierarchyId }
      getUserWithOrgSpy.mockResolvedValueOnce({
        id: faker.datatype.uuid(),
        email: faker.internet.email(),
        name: faker.name.fullName(),
        isActive: true,
        deleteAt: null,
        organizations: [
          {
            organizationId: faker.datatype.uuid(),
          },
        ],
      })
      const createdFile = {
        id: faker.datatype.uuid(),
        fileId: faker.datatype.uuid(),
        path: `${pathRoot}${files[0].filename}`,
      }
      deleteFileSpy.mockResolvedValue(Promise.resolve([hierarchyId, createdFile.id]))
      const resultDelete = await deleteHierarchy.handler(event, ctx)
      expect(resultDelete.statusCode).toEqual(200)

      // Create folder again
      createHierarchySpy.mockResolvedValueOnce(createdRootFolderResult)
      event.params = { folder: pathRoot }
      resultRoot = await postHierarchy.handler(event, ctx)
      expect(resultRoot.statusCode).toEqual(201)
    })
  })

  describe('get /hierarchy/list/preset', () => {
    it('Return 200: should list presets successfully', async () => {
      const userPresets = [
        {
          id: faker.datatype.uuid(),
          path: '/',
          deleteAt: null,
          file: null,
        },
        {
          id: faker.datatype.uuid(),
          path: '/preset.vectornator',
          deleteAt: null,
          file: { id: faker.datatype.uuid(), name: 'preset.vectornator', type: FileType.PRESET, thumbnail: null },
        },
      ]
      getUserHierarchiesSpy.mockResolvedValue(userPresets)

      const { getPresetList } = await import('../handlers')
      const res = await getPresetList.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual([
        {
          id: userPresets[0].id,
          path: '/',
          deleteAt: null,
          files: [
            {
              id: userPresets[1].file?.id,
              hierarchyId: userPresets[1].id,
              path: '/preset.vectornator',
              name: 'preset.vectornator',
              deleteAt: null,
              thumbnail: null,
              type: 'preset',
            },
          ],
          children: [],
        },
      ])
    })
  })
})
