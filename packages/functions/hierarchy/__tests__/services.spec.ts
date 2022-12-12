import { FileStatus, FileType } from '@layers/prisma'
import { faker } from '@faker-js/faker'
import { HierarchyService } from '../services'

const findHierarchyFirstMock = jest.fn()
const createHierarchyMock = jest.fn()
const createFileMock = jest.fn()
const findHierarchyManyMock = jest.fn()
const findFileFirstMock = jest.fn()
const createManyFileContentMock = jest.fn()
const findFirstFileContent = jest.fn()
const findManyFileContent = jest.fn()
const executeRawMock = jest.fn()
const updateHierarchyMock = jest.fn()
const updateFileMock = jest.fn()
const updateManyFileMock = jest.fn()
const updateManyHierarchyMock = jest.fn()
const countHierarchyMock = jest.fn()
const createManyFileMock = jest.fn()
const createManyHierarchyMock = jest.fn()
const findFileManyMock = jest.fn()
const transactionMock = jest.fn()
const queryRawMock = jest.fn()

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  hierarchy: {
    findFirst: findHierarchyFirstMock,
    create: createHierarchyMock,
    findMany: findHierarchyManyMock,
    update: updateHierarchyMock,
    updateMany: updateManyHierarchyMock,
    count: countHierarchyMock,
    createMany: createManyHierarchyMock,
  },
  file: {
    create: createFileMock,
    findFirst: findFileFirstMock,
    update: updateFileMock,
    updateMany: updateManyFileMock,
    createMany: createManyFileMock,
    findMany: findFileManyMock,
  },
  fileContent: {
    createMany: createManyFileContentMock,
    findFirst: findFirstFileContent,
    findMany: findManyFileContent,
  },
  $executeRaw: executeRawMock,
  $transaction: transactionMock,
  $queryRaw: queryRawMock,
}

const uuid = 'ca9c6f9f-428d-4beb-8ede-de5a528062d2'
jest.mock('uuid', () => ({ v4: () => uuid }))

const userId = faker.datatype.uuid()
const fileId = faker.datatype.uuid()
const deviceId = faker.datatype.uuid()
const hierarchyId = faker.datatype.uuid()
const hierarchy = { id: hierarchyId, path: '/abc/', userId }

describe('hierarchy/services.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('isValidHierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should return true - root folder', async () => {
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.isValidHierarchy(userId, 'abc')

      expect(res).toEqual(true)
    })

    it('should return true - not a root folder', async () => {
      findHierarchyManyMock.mockResolvedValue([
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
      ])

      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.isValidHierarchy(userId, '/abc/def/xyz')

      expect(res).toEqual(true)
    })

    it('should return true - not a root folder - include current path', async () => {
      findHierarchyManyMock.mockResolvedValue([
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
        { id: faker.datatype.uuid() },
      ])

      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.isValidHierarchy(userId, '/abc/def/xyz', true)

      expect(res).toEqual(true)
    })

    it('should return false', async () => {
      findHierarchyManyMock.mockResolvedValue([])

      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.isValidHierarchy(userId, '/abc/def')

      expect(res).toEqual(false)
    })
  })

  describe('getHierarchyTreeAndFiles', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })
    const hierarchyIds = [
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
      faker.datatype.uuid(),
    ]
    const fileIds = [faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid(), faker.datatype.uuid()]

    it('should get correct hierarchy tree for owner', () => {
      const hierarchies = [
        {
          id: hierarchyIds[0],
          path: '/abc/',
          deleteAt: null,
        },
        {
          id: hierarchyIds[1],
          path: '/abc/xyz/',
          deleteAt: null,
        },
        {
          id: hierarchyIds[2],
          path: '/abc/def/',
          deleteAt: null,
        },
        {
          id: hierarchyIds[3],
          path: '/abc/def/jdk/',
          deleteAt: null,
        },
        {
          id: hierarchyIds[4],
          path: '/abc/def/xyz/',
          deleteAt: null,
        },
        {
          id: hierarchyIds[5],
          path: '/abc/def/file_1.vectornator',
          deleteAt: null,
          file: {
            id: fileIds[0],
            name: 'file_1.vectornator',
            type: FileType.VECTORNATOR,
          },
        },
        {
          id: hierarchyIds[6],
          path: '/abc/def/file_2.vectornator',
          deleteAt: null,
          file: {
            id: fileIds[1],
            name: 'file_2.vectornator',
            type: FileType.VECTORNATOR,
          },
        },
        {
          id: hierarchyIds[7],
          path: '/abc/def/xyz/file_3.animator',
          deleteAt: null,
          file: {
            id: fileIds[2],
            name: 'file_3.animator',
            type: FileType.ANIMATOR,
          },
        },
      ]

      const hierarchyTree = [
        {
          id: hierarchyIds[0],
          path: '/abc/',
          files: [],
          deleteAt: null,
          children: [
            {
              id: hierarchyIds[1],
              path: '/abc/xyz/',
              files: [],
              deleteAt: null,
              children: [],
            },
            {
              id: hierarchyIds[2],
              path: '/abc/def/',
              files: [
                {
                  id: fileIds[0],
                  hierarchyId: hierarchyIds[5],
                  name: 'file_1.vectornator',
                  path: '/abc/def/file_1.vectornator',
                  type: 'vectornator',
                  thumbnail: null,
                  deleteAt: null,
                },
                {
                  id: fileIds[1],
                  hierarchyId: hierarchyIds[6],
                  name: 'file_2.vectornator',
                  path: '/abc/def/file_2.vectornator',
                  type: 'vectornator',
                  thumbnail: null,
                  deleteAt: null,
                },
              ],
              deleteAt: null,
              children: [
                {
                  id: hierarchyIds[3],
                  path: '/abc/def/jdk/',
                  files: [],
                  deleteAt: null,
                  children: [],
                },
                {
                  id: hierarchyIds[4],
                  path: '/abc/def/xyz/',
                  files: [
                    {
                      id: fileIds[2],
                      hierarchyId: hierarchyIds[7],
                      name: 'file_3.animator',
                      path: '/abc/def/xyz/file_3.animator',
                      type: 'animator',
                      thumbnail: null,
                      deleteAt: null,
                    },
                  ],
                  deleteAt: null,
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      const hierarchyService = new HierarchyService(prismaClient)
      const res = hierarchyService.getHierarchyTreeAndFiles(hierarchies)

      expect(res).toEqual({ files: [], hierarchies: hierarchyTree })
    })

    it('should get correct hierarchy tree and files for trashed', () => {
      const deleteAt = new Date()
      const hierarchies = [
        {
          id: hierarchyIds[0],
          path: '/abc/',
          deleteAt,
        },
        {
          id: hierarchyIds[1],
          path: '/abc/xyz/',
          deleteAt,
        },
        {
          id: hierarchyIds[2],
          path: '/abc/def/',
          deleteAt,
        },
        {
          id: hierarchyIds[3],
          path: '/abc/def/jdk/',
          deleteAt,
        },
        {
          id: hierarchyIds[4],
          path: '/abc/def/xyz/',
          deleteAt,
        },
        {
          id: hierarchyIds[5],
          path: '/abc/def/file_1.vectornator',
          deleteAt,
          file: {
            id: fileIds[0],
            name: 'file_1.vectornator',
            type: FileType.VECTORNATOR,
            thumbnail: null,
          },
        },
        {
          id: hierarchyIds[6],
          path: '/abc/def/file_2.vectornator',
          deleteAt,
          file: {
            id: fileIds[1],
            name: 'file_2.vectornator',
            type: FileType.VECTORNATOR,
            thumbnail: null,
          },
        },
        {
          id: hierarchyIds[7],
          path: '/abc/def/xyz/file_3.animator',
          deleteAt,
          file: {
            id: fileIds[2],
            name: 'file_3.animator',
            thumbnail: null,
            type: FileType.ANIMATOR,
          },
        },
        {
          id: hierarchyIds[8],
          path: '/abc/def/ghz/file_4.vectornator',
          deleteAt,
          file: {
            id: fileIds[3],
            name: 'file_4.vectornator',
            type: FileType.VECTORNATOR,
            thumbnail: null,
          },
        },
      ]

      const hierarchyTree = [
        {
          id: hierarchyIds[0],
          path: '/abc/',
          files: [],
          deleteAt,
          children: [
            {
              id: hierarchyIds[1],
              path: '/abc/xyz/',
              deleteAt,
              files: [],
              children: [],
            },
            {
              id: hierarchyIds[2],
              path: '/abc/def/',
              deleteAt,
              files: [
                {
                  id: fileIds[0],
                  hierarchyId: hierarchyIds[5],
                  name: 'file_1.vectornator',
                  path: '/abc/def/file_1.vectornator',
                  type: 'vectornator',
                  thumbnail: null,
                  deleteAt,
                },
                {
                  id: fileIds[1],
                  hierarchyId: hierarchyIds[6],
                  name: 'file_2.vectornator',
                  path: '/abc/def/file_2.vectornator',
                  type: 'vectornator',
                  thumbnail: null,
                  deleteAt,
                },
              ],
              children: [
                {
                  id: hierarchyIds[3],
                  path: '/abc/def/jdk/',
                  deleteAt,
                  files: [],
                  children: [],
                },
                {
                  id: hierarchyIds[4],
                  path: '/abc/def/xyz/',
                  deleteAt,
                  files: [
                    {
                      id: fileIds[2],
                      hierarchyId: hierarchyIds[7],
                      name: 'file_3.animator',
                      path: '/abc/def/xyz/file_3.animator',
                      thumbnail: null,
                      type: 'animator',
                      deleteAt,
                    },
                  ],
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      const hierarchyService = new HierarchyService(prismaClient)
      const res = hierarchyService.getHierarchyTreeAndFiles(hierarchies)

      expect(res).toEqual({
        files: [
          {
            id: fileIds[3],
            hierarchyId: hierarchyIds[8],
            name: 'file_4.vectornator',
            path: '/abc/def/ghz/file_4.vectornator',
            deleteAt,
            type: 'vectornator',
            thumbnail: null,
          },
        ],
        hierarchies: hierarchyTree,
      })
    })
  })

  describe('createHierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should create hierarchy successfully', async () => {
      createHierarchyMock.mockResolvedValueOnce(hierarchy)

      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.createHierarchy(faker.datatype.uuid(), '/abc/xyz', deviceId)

      expect(res).toEqual(hierarchy)
    })
  })

  describe('getHierarchyByPath', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const path = '/abc/xyz'
    it('should found the Hierarchy by path', async () => {
      findHierarchyFirstMock.mockReturnValue(hierarchy)
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.getHierarchyByPath(userId, path)
      expect(res).toEqual(hierarchy)
    })
  })

  describe('renameFile', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const newPath = 'new.vectornator'
    it('Rename file successfully', async () => {
      updateFileMock.mockResolvedValue(Promise.resolve({ id: fileId }))
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.renameFile(fileId, newPath, deviceId)
      expect(res?.id).toEqual(fileId)
    })
  })

  describe('updatePathHierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const userId = faker.datatype.uuid()
    const newPath = '/abc/xyz'
    const oldPath = '/abc/dbcf'

    it('No row update', async () => {
      transactionMock.mockResolvedValueOnce(Promise.resolve([0]))
      executeRawMock.mockResolvedValue(Promise.resolve(0))
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.updatePathHierarchy(userId, newPath, oldPath, false, deviceId)
      expect(res?.length).toEqual(0)
    })

    it('should rename folder successfully', async () => {
      transactionMock.mockResolvedValueOnce(Promise.resolve([1]))
      executeRawMock.mockResolvedValue(Promise.resolve(1))
      findHierarchyManyMock.mockResolvedValue(
        Promise.resolve([
          {
            id: faker.datatype.uuid,
            path: newPath,
          },
        ]),
      )
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.updatePathHierarchy(userId, newPath, oldPath, false, deviceId)
      expect(res?.length).toBeGreaterThan(0)
    })

    it('should rename file successfully', async () => {
      transactionMock.mockResolvedValueOnce(Promise.resolve([1]))
      executeRawMock.mockResolvedValue(Promise.resolve(1))
      findHierarchyManyMock.mockResolvedValue(
        Promise.resolve([
          {
            id: faker.datatype.uuid,
            path: newPath,
          },
        ]),
      )
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.updatePathHierarchy(userId, newPath, oldPath, true, deviceId)
      expect(res?.length).toBeGreaterThan(0)
    })
  })

  describe('deleteFile', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const files = [
      {
        id: faker.datatype.uuid(),
        path: '/abc/file.vectornator',
        userId,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/file.vectornator',
        userId,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/file-1.vectornator',
        userId,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/file-2.vectornator',
        userId,
      },
    ]

    const hierarchies = [
      {
        id: hierarchy.id,
        path: hierarchy.path,
        userId,
        fileId,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/',
        userId,
        fileId,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/folder1/',
        userId,
        fileId,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/file.vectornator',
        userId,
        fileId: files[0].id,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/file.vectornator',
        userId,
        fileId: files[1].id,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/file-1.vectornator',
        userId,
        fileId: files[2].id,
      },
      {
        id: faker.datatype.uuid(),
        path: '/abc/xyz/file-2.vectornator',
        userId,
        fileId: files[3].id,
      },
    ]

    it('should delete file successfully', async () => {
      findHierarchyFirstMock.mockResolvedValue(hierarchies[3])
      updateHierarchyMock.mockResolvedValue({
        id: hierarchies[3].id,
      })
      updateFileMock.mockResolvedValue({
        id: hierarchies[3].fileId,
      })
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.deleteFile(hierarchies[3], userId, deviceId)
      expect(res.length).toEqual(1)
    })

    it('should delete file permanently successfully', async () => {
      findHierarchyFirstMock.mockResolvedValue(hierarchies[3])
      updateHierarchyMock.mockResolvedValue({
        id: hierarchies[3].id,
      })
      updateFileMock.mockResolvedValue({
        id: hierarchies[3].fileId,
      })
      const hierarchyService = new HierarchyService(prismaClient)
      const result = await hierarchyService.deleteFile(hierarchies[3], userId, deviceId, true)
      expect(result?.length).toEqual(1)
    })

    it('should delete folder successfully', async () => {
      findHierarchyManyMock.mockResolvedValue(hierarchies)
      updateManyFileMock.mockResolvedValue({ count: files.length })
      updateManyHierarchyMock.mockResolvedValue({ count: hierarchies.length })
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.deleteFile(hierarchy, userId, deviceId)
      expect(res.length).toEqual(hierarchies.length)
    })

    it('should delete folder permanently successfully', async () => {
      findHierarchyManyMock.mockResolvedValue(hierarchies)
      updateManyFileMock.mockResolvedValue({ count: files.length })
      updateManyHierarchyMock.mockResolvedValue({ count: hierarchies.length })

      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.deleteFile(hierarchy, userId, deviceId, true)
      expect(res.length).toEqual(hierarchies.length)
    })
  })

  describe('getHierarchyById', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should get hierarchy successfully', async () => {
      findHierarchyFirstMock.mockReset().mockResolvedValue(hierarchy)

      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.getHierarchyById(hierarchyId, userId)

      expect(res).toEqual(hierarchy)
    })
  })

  describe('getUserHierarchies', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should get owner hierarchy successfully', async () => {
      const hierarchies = [
        {
          id: faker.datatype.uuid(),
          path: '/abc/',
          deleteAt: null,
          file: null,
        },
      ]
      findHierarchyManyMock.mockReset().mockResolvedValueOnce(hierarchies)

      const fileService = new HierarchyService(prismaClient)
      const res = await fileService.getUserHierarchies(userId, false)

      expect(res).toEqual(hierarchies)
    })

    it('should get owner hierarchy from specific path successfully', async () => {
      const hierarchies = [
        {
          id: faker.datatype.uuid(),
          path: '/abc/',
          deleteAt: null,
          file: null,
        },
      ]
      findHierarchyManyMock.mockReset().mockResolvedValueOnce(hierarchies)

      const fileService = new HierarchyService(prismaClient)
      const res = await fileService.getUserHierarchies(userId, false, '/abc/')

      expect(res).toEqual(hierarchies)
    })

    it('should get trashed hierarchy successfully', async () => {
      const hierarchies = [
        {
          id: faker.datatype.uuid(),
          path: '/abc/',
          deleteAt: new Date(),
          file: null,
        },
      ]
      findHierarchyManyMock.mockReset().mockResolvedValueOnce(hierarchies)

      const fileService = new HierarchyService(prismaClient)
      const res = await fileService.getUserHierarchies(userId, true)

      expect(res).toEqual(hierarchies)
    })

    it('should get preset hierarchy successfully', async () => {
      findHierarchyManyMock.mockReset().mockResolvedValueOnce([
        {
          id: faker.datatype.uuid(),
          path: '/abc/',
          deleteAt: new Date(),
          file: null,
        },
      ])

      const fileService = new HierarchyService(prismaClient)
      const res = await fileService.getUserHierarchies(userId, false, undefined, 'preset')

      expect(findHierarchyManyMock).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              userId,
              type: FileType.PRESET,
              user: {
                deleteAt: null,
              },
            },
            {
              userId,
              path: '/',
              user: {
                deleteAt: null,
              },
            },
          ],
        },
        select: {
          id: true,
          path: true,
          deleteAt: true,
          file: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: [{ path: 'asc' }],
      })
    })
  })

  describe('recoverHierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('should recover file successfully', async () => {
      const hierarchy = {
        id: hierarchyId,
        path: '/abc/xyz/file.vectornator',
        fileId: faker.datatype.uuid(),
      }
      const parentHierarchy = {
        id: hierarchyId,
        path: '/abc/xyz/',
        fileId: null,
        deleteAt: null,
      }
      findHierarchyFirstMock
        .mockReset()
        .mockResolvedValueOnce(Promise.resolve(hierarchy))
        .mockResolvedValueOnce(Promise.resolve(parentHierarchy))
      countHierarchyMock.mockResolvedValue(Promise.resolve(0))
      updateHierarchyMock.mockResolvedValue(
        Promise.resolve({
          id: hierarchyId,
        }),
      )
      findHierarchyManyMock.mockResolvedValue(Promise.resolve(parentHierarchy))
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.recoverHierarchy(hierarchy, userId, deviceId)
      expect(res.length).toEqual(1)
    })

    it('should recover folder successfully', async () => {
      const parentHierarchy = {
        id: hierarchyId,
        path: '/abc/',
        fileId: null,
        deleteAt: null,
      }
      const hierarchy = {
        id: hierarchyId,
        path: '/abc/xyz/',
        fileId: null,
        deleteAt: new Date(),
      }
      const hierarchiesFile = [
        {
          id: faker.datatype.uuid(),
          fileId: faker.datatype.uuid(),
          path: '/abc/xyz/file1.vectornator',
          deleteAt: new Date(),
        },
        {
          id: faker.datatype.uuid(),
          fileId: faker.datatype.uuid(),
          path: '/abc/xyz/file2.vectornator',
          deleteAt: new Date(),
        },
      ]
      const hierarchiesRecover = [
        ...hierarchiesFile,
        {
          id: faker.datatype.uuid(),
          fileId: null,
          path: '/abc/xyz/tmp/',
          deleteAt: new Date(),
        },
        {
          id: faker.datatype.uuid(),
          fileId: null,
          path: '/abc/xyz/tmp1/',
          deleteAt: new Date(),
        },
      ]

      findHierarchyFirstMock
        .mockReset()
        .mockResolvedValueOnce(Promise.resolve(hierarchy))
        .mockResolvedValueOnce(Promise.resolve(parentHierarchy))
      countHierarchyMock.mockResolvedValue(Promise.resolve(0))
      findHierarchyManyMock.mockResolvedValueOnce(Promise.resolve(hierarchiesRecover))
      updateManyFileMock.mockResolvedValue(Promise.resolve({ count: hierarchiesFile.length }))
      updateManyHierarchyMock.mockResolvedValue(Promise.resolve({ count: hierarchiesRecover.length }))
      const hierarchyService = new HierarchyService(prismaClient)
      const res = await hierarchyService.recoverHierarchy(hierarchy, userId, deviceId)
      expect(res.length).toEqual(hierarchiesRecover.length)
    })
  })

  describe('createBatchHierarchy', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const organizationId = faker.datatype.uuid()
    it('should create batch hierarchy successfully', async () => {
      const batchHierarchies = [
        { name: '/abc/xyz/file_1.vectornator', size: '9223372036854775807', type: 'vectornator' },
        { name: '/abc/xyz/file_2.vectornator', size: '2', type: 'vectornator' },
      ]
      createManyFileMock.mockReset().mockResolvedValue({ count: 2 })
      createManyHierarchyMock.mockReset().mockResolvedValue({ count: 5 })

      const hierarchyService = new HierarchyService(prismaClient)
      await hierarchyService.createBatchHierarchy(userId, deviceId, organizationId, batchHierarchies)

      expect(prismaClient.file.createMany).toHaveBeenCalledWith({
        data: [
          {
            id: uuid,
            userId,
            deviceId,
            organizationId,
            name: 'file_1.vectornator',
            size: BigInt('9223372036854775807'),
            status: 'CLOSED',
            checksum: '',
            type: 'VECTORNATOR',
          },
          {
            id: uuid,
            userId,
            deviceId,
            organizationId,
            name: 'file_2.vectornator',
            size: BigInt(2),
            status: 'CLOSED',
            checksum: '',
            type: 'VECTORNATOR',
          },
        ],
        skipDuplicates: true,
      })
      expect(prismaClient.hierarchy.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId,
            deviceId,
            path: '/',
            fileId: null,
            status: FileStatus.ACTIVE,
            type: null,
          },
          {
            userId,
            deviceId,
            path: '/abc/',
            fileId: null,
            status: FileStatus.ACTIVE,
            type: null,
          },
          {
            userId,
            deviceId,
            path: '/abc/xyz/',
            fileId: null,
            status: FileStatus.ACTIVE,
            type: null,
          },
          {
            userId,
            deviceId,
            path: '/abc/xyz/file_1.vectornator',
            fileId: uuid,
            status: FileStatus.ACTIVE,
            type: 'VECTORNATOR',
          },
          {
            userId,
            deviceId,
            path: '/abc/xyz/file_2.vectornator',
            fileId: uuid,
            status: FileStatus.ACTIVE,
            type: 'VECTORNATOR',
          },
        ],
        skipDuplicates: true,
      })
    })
  })

  describe('changeDuplicatedNameDeleteFlow', () => {
    it('The path not existed in trash', async () => {
      queryRawMock.mockResolvedValue(Promise.resolve([{ count: 0 }]))
      const hierarchyService = new HierarchyService(prismaClient)
      const hierarchySelected = {
        id: hierarchyId,
        path: '/abc/xyz/',
        fileId: null,
        deleteAt: null,
        userId,
        deviceId
      }
      const res = await hierarchyService.changeDuplicatedNameDeleteFlow(hierarchySelected, userId, deviceId)
      
      expect(res.path).toEqual(hierarchySelected.path)
    })
    it('The path existed in trash', async () => {
      queryRawMock.mockResolvedValue(Promise.resolve([{ count: 1 }]))
      transactionMock.mockResolvedValueOnce(Promise.resolve([1]))
      executeRawMock.mockResolvedValue(Promise.resolve(1))
      const hierarchyService = new HierarchyService(prismaClient)
      const hierarchySelected = {
        id: hierarchyId,
        path: '/abc/xyz/',
        fileId: null,
        deleteAt: null,
        userId,
        deviceId
      }

      const hierarchyUpdated = {
        ...hierarchySelected,
        path: '/abc/xyz 2/'
      }

      findHierarchyFirstMock.mockReset().mockResolvedValue(hierarchyUpdated)
      const res = await hierarchyService.changeDuplicatedNameDeleteFlow(hierarchySelected, userId, deviceId)
      expect(res.path).toEqual(hierarchyUpdated.path)
    })
  })
})
