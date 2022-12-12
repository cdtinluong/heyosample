import { faker } from '@faker-js/faker'
import { FileStatus, FileType } from '@layers/prisma'
import { FileHelper } from '@layers/file'
import { ConflictResolution, FileService } from '../services'

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
const updateFileContentMock = jest.fn()
const transactionMock = jest.fn()
const queryRawMock = jest.fn()
const findManyFileContentHistoryMock = jest.fn()

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  hierarchy: {
    findFirst: findHierarchyFirstMock,
    create: createHierarchyMock,
    findMany: findHierarchyManyMock,
    update: updateHierarchyMock,
    updateMany: updateManyHierarchyMock,
  },
  file: {
    create: createFileMock,
    findFirst: findFileFirstMock,
    update: updateFileMock,
    updateMany: updateManyFileMock,
  },
  fileContent: {
    createMany: createManyFileContentMock,
    findFirst: findFirstFileContent,
    findMany: findManyFileContent,
    update: updateFileContentMock,
  },
  fileContentHistory: {
    findMany: findManyFileContentHistoryMock,
  },
  $executeRaw: executeRawMock,
  $transaction: transactionMock,
  $queryRaw: queryRawMock,
}

const fileHelper = Object.getPrototypeOf(new FileHelper())
const uploadMultipartSpy = jest.spyOn(fileHelper, 'uploadMultipart')
const completeMultipartUploadSpy = jest.spyOn(fileHelper, 'completeMultipartUpload')
const abortMultipartUploadSpy = jest.spyOn(fileHelper, 'abortMultipartUpload')
const downloadMultipartSpy = jest.spyOn(fileHelper, 'downloadMultipart')
const deleteObjectsSpy = jest.spyOn(fileHelper, 'deleteObjects')

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  ...jest.requireActual('@aws-sdk/s3-request-presigner'),
  getSignedUrl: jest.fn().mockResolvedValue(faker.datatype.string()),
}))

const presignedUrl = 'https://presignedUrl'
const userId = faker.datatype.uuid()
const fileId = faker.datatype.uuid()
const deviceId = faker.datatype.uuid()
const hierarchyId = faker.datatype.uuid()
const orgId = faker.datatype.uuid()

const fileContent = {
  id: faker.datatype.uuid(),
  name: 'media.dat',
  size: BigInt(10000000),
  version: '1',
  status: FileStatus.ACTIVE,
}

describe('file/services.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createFile', () => {
    it('should create file successfully', async () => {
      const createdFile = {
        hierarchy: { id: hierarchyId, path: 'abc/xyz/test.txt', fileId },
      }
      createFileMock.mockResolvedValueOnce({ ...createdFile })

      const fileService = new FileService(prismaClient)
      const result = await fileService.createFile(userId, orgId, 'abc/xyz/', 'test.txt', '9223372036854775807', 'animator', deviceId)

      expect(result).toEqual(createdFile)
      expect(createFileMock).toHaveBeenCalledWith({
        data: {
          size: BigInt('9223372036854775807'),
          user: { connect: { id: userId } },
          name: 'test.txt',
          organization: { connect: { id: orgId } },
          checksum: '',
          status: FileStatus.CLOSED,
          deviceId,
          type: FileType.ANIMATOR,
          hierarchy: {
            create: {
              path: `abc/xyz/test.txt`,
              userId,
              deviceId,
              status: FileStatus.ACTIVE,
              type: FileType.ANIMATOR,
            },
          },
        },
        select: {
          hierarchy: true,
        },
      })
    })
  })

  describe('getFileContentByFileId', () => {
    it('Returns file contents successfully', async () => {
      const names = [`${faker.commerce.productMaterial()}.img`, `${faker.commerce.productMaterial()}.img`]
      const fileContents = [
        {
          id: faker.datatype.uuid(),
          name: names[0],
          size: faker.datatype.bigInt(),
        },
        {
          id: faker.datatype.uuid(),
          name: names[1],
          size: faker.datatype.bigInt(),
        },
      ]
      findManyFileContent.mockReturnValue(Promise.resolve(fileContents))
      const fileService = new FileService(prismaClient)
      const result = await fileService.getFileContentByFileId(userId, fileId, names)
      expect(result).toEqual(fileContents)
    })
  })

  describe('downloadFiles', () => {
    it('should download files successfully', async () => {
      const presignedUrls = [presignedUrl, presignedUrl]
      downloadMultipartSpy.mockResolvedValue({ presignedUrls, chunkSize: 5 })

      const fileService = new FileService(prismaClient)
      const result = await fileService.downloadFiles(userId, fileId, [fileContent])

      expect(result).toEqual([
        {
          name: 'media.dat',
          version: '1',
          presignedUrls,
          chunkSize: 5,
        },
      ])
    })
  })

  describe('getFileById', () => {
    it('should get file successfully', async () => {
      const file = { id: fileId }
      findFileFirstMock.mockResolvedValueOnce(file)

      const fileService = new FileService(prismaClient)
      const result = await fileService.getFileById(fileId, userId)

      expect(result).toEqual(file)
    })
  })

  describe('upsertFileContents', () => {
    it('should upsert file contents successfully', async () => {
      executeRawMock.mockResolvedValue(1)

      const fileService = new FileService(prismaClient)
      await fileService.upsertFileContents(deviceId, fileId, [
        { name: 'media.dat', size: faker.datatype.number() },
        { name: 'data.json', size: faker.datatype.number() },
      ])

      expect(executeRawMock).toHaveBeenCalled()
    })
  })

  describe('uploadFiles', () => {
    it('should upload files successfully', async () => {
      const name = 'media.dat'
      const presignedUrls = [presignedUrl, presignedUrl]
      uploadMultipartSpy.mockResolvedValue({ uploadId: 'uploadId', presignedUrls, chunkSize: 5 })

      const fileService = new FileService(prismaClient)
      const res = await fileService.uploadFiles(userId, fileId, deviceId, [{ name, size: 100000 }])

      expect(res).toEqual([
        {
          name: 'media.dat',
          uploadId: 'uploadId',
          chunkSize: 5,
          presignedUrls,
        },
      ])
    })
  })

  describe('completeMultipartUpload', () => {
    it('should complete uploading files successfully - all files are completed successfully', async () => {
      const name_1 = 'media.dat'
      const name_2 = 'image.jpg'
      completeMultipartUploadSpy
        .mockResolvedValueOnce({ Key: `${userId}/${fileId}/${name_1}`, VersionId: '2' })
        .mockResolvedValueOnce({ Key: `${userId}/${fileId}/${name_2}`, VersionId: '2' })
      updateFileMock.mockResolvedValue({})
      findManyFileContent.mockResolvedValueOnce([
        { id: faker.datatype.uuid(), name: name_1, size: 1 },
        { id: faker.datatype.uuid(), name: name_2, size: 2 },
      ])

      const fileService = new FileService(prismaClient)
      const result = await fileService.completeMultipartUpload(userId, fileId, deviceId, false, [
        {
          uploadId: faker.datatype.string(),
          name: name_1,
          version: '1',
          parts: [{ PartNumber: 1, ETag: faker.datatype.string() }],
        },
        {
          uploadId: faker.datatype.string(),
          name: name_2,
          version: '1',
          parts: [{ PartNumber: 1, ETag: faker.datatype.string() }],
        },
      ])

      expect(result).toEqual({
        failures: [],
        successes: [
          { name: 'media.dat', version: '2' },
          { name: 'image.jpg', version: '2' },
        ],
      })
      expect(completeMultipartUploadSpy).toHaveBeenCalledTimes(2)
      expect(prismaClient.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: {
          status: FileStatus.UPLOADED,
          size: 3,
          deviceId,
          hasConflict: false,
        },
      })
      expect(prismaClient.fileContent.findMany).toHaveBeenCalledWith({
        where: {
          fileId,
          deleteAt: null,
          status: { notIn: [FileStatus.ABORTED, FileStatus.FAILED] },
        },
        select: {
          id: true,
          name: true,
          size: true,
        },
      })
    })

    it('should complete uploading files successfully - some files cannot complete uploading', async () => {
      const name_1 = 'media.dat'
      const name_2 = 'image.jpg'
      const name_3 = 'file.json'
      const name_4 = 'file.png'
      completeMultipartUploadSpy
        .mockResolvedValueOnce({ Key: `${userId}/${fileId}/${name_1}`, VersionId: '2' })
        .mockResolvedValueOnce({ Key: `${userId}/${fileId}/${name_2}`, VersionId: '2' })
        .mockRejectedValue({})
      updateFileMock.mockResolvedValue({})
      findManyFileContent.mockResolvedValueOnce([
        { id: faker.datatype.uuid(), name: name_1, size: 1 },
        { id: faker.datatype.uuid(), name: name_2, size: 2 },
        { id: faker.datatype.uuid(), name: name_3, size: 3 },
        { id: faker.datatype.uuid(), name: name_4, size: 4 },
      ])

      const fileService = new FileService(prismaClient)
      const result = await fileService.completeMultipartUpload(userId, fileId, deviceId, false, [
        {
          uploadId: faker.datatype.string(),
          name: name_1,
          version: '1',
          parts: [{ PartNumber: 1, ETag: faker.datatype.string() }],
        },
        {
          uploadId: faker.datatype.string(),
          name: name_2,
          version: '1',
          parts: [{ PartNumber: 1, ETag: faker.datatype.string() }],
        },
        {
          uploadId: faker.datatype.string(),
          name: name_3,
          version: '1',
          parts: [{ PartNumber: 1, ETag: faker.datatype.string() }],
        },
      ])

      expect(result).toEqual({
        failures: ['file.json'],
        successes: [
          { name: 'media.dat', version: '2' },
          { name: 'image.jpg', version: '2' },
        ],
      })
      expect(completeMultipartUploadSpy).toHaveBeenCalledTimes(3)
      expect(prismaClient.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: {
          status: FileStatus.UPLOADING,
          hasConflict: false,
          size: 7,
          deviceId,
        },
      })
      expect(prismaClient.fileContent.findMany).toHaveBeenCalledWith({
        where: {
          fileId,
          deleteAt: null,
          status: { notIn: [FileStatus.ABORTED, FileStatus.FAILED] },
        },
        select: {
          id: true,
          name: true,
          size: true,
        },
      })
    })
  })

  describe('abortMultipartUpload', () => {
    it('should abort uploading files successfully', async () => {
      abortMultipartUploadSpy.mockResolvedValue({ RequestCharged: userId })

      const fileService = new FileService(prismaClient)
      await fileService.abortMultipartUpload(userId, fileId, [
        { uploadId: faker.datatype.string(), name: faker.datatype.string() },
      ])

      expect(abortMultipartUploadSpy).toHaveBeenCalled()
    })
  })

  describe('getFileWithContentsById', () => {
    it('should get file with contents successfully', async () => {
      findFileFirstMock.mockResolvedValue({})

      const fileService = new FileService(prismaClient)
      const res = await fileService.getFileWithContentsById(fileId, userId)

      expect(findFileFirstMock).toHaveBeenCalledWith({
        where: {
          id: fileId,
          deleteAt: null,
          userId,
          user: { deleteAt: null },
        },
        select: {
          id: true,
          name: true,
          size: true,
          checksum: true,
          status: true,
          hasConflict: true,
          deleteAt: true,
          type: true,
          contents: {
            where: {
              deleteAt: null,
            },
            select: {
              id: true,
              name: true,
              size: true,
              status: true,
              version: true,
            },
          },
        },
      })
    })
  })

  describe('getConflictedFileContents', () => {
    it('should return list of conflicted file contents', async () => {
      const fileContents = [
        { id: faker.datatype.uuid(), name: 'media.dat', version: '2', size: 1, status: FileStatus.UPLOADED },
        { id: faker.datatype.uuid(), name: 'data.json', version: '2', size: 1, status: FileStatus.UPLOADING },
        { id: faker.datatype.uuid(), name: 'image.png', version: '2', size: 1, status: FileStatus.UPLOADING },
      ]
      findManyFileContent.mockResolvedValue(fileContents)
      findManyFileContentHistoryMock.mockResolvedValue([
        { ...fileContents[1], fileContentId: fileContents[1].id },
        { ...fileContents[2], fileContentId: fileContents[2].id },
      ])

      const fileService = new FileService(prismaClient)
      const res = await fileService.getConflictedFileContents(userId, deviceId, fileId, [
        { name: fileContents[0].name, version: '1' },
        { name: fileContents[1].name, version: '2' },
        { name: fileContents[2].name, version: '2' },
      ])

      expect(res.length).toBe(3)
      expect(res).toBeInstanceOf(Array)
      expect(findManyFileContent).toHaveBeenCalledWith({
        where: {
          fileId,
          name: { in: ['media.dat', 'data.json', 'image.png'] },
          deleteAt: null,
          file: {
            userId,
            user: { deleteAt: null },
          },
        },
        select: {
          id: true,
          name: true,
          size: true,
          version: true,
          status: true,
        },
      })
      expect(findManyFileContentHistoryMock).toHaveBeenCalledWith({
        where: {
          fileId,
          status: FileStatus.UPLOADING,
          deviceId: { not: deviceId },
          fileContentId: { in: [fileContents[1].id, fileContents[2].id] },
        },
        distinct: ['deviceId'],
        orderBy: { createdAt: 'desc' },
        select: {
          fileContentId: true,
          name: true,
          size: true,
          version: true,
          status: true,
        },
      })
    })
  })

  describe('resolveConflict', () => {
    const fileContentName = 'media.dat'

    it('should resolve conflict successfully - download change 1', async () => {
      updateFileMock.mockResolvedValue({})
      updateFileContentMock.mockResolvedValue({})
      transactionMock.mockResolvedValue({})
      deleteObjectsSpy.mockResolvedValue({})
      const fileContentId = faker.datatype.uuid()
      queryRawMock
        .mockResolvedValueOnce([{ file_content_id: fileContentId, name: fileContentName, version: '1', size: 1 }])
        .mockResolvedValueOnce([{ file_content_id: fileContentId, name: fileContentName, version: '2', size: 1 }])

      const fileService = new FileService(prismaClient)
      await fileService.resolveConflict(userId, fileId, deviceId, ConflictResolution.DOWNLOAD_CHANGE, [
        { name: fileContentName, keepingVersion: '1', deletingVersion: '2' },
      ])

      expect(updateFileMock).toHaveBeenCalledWith({
        where: { id: fileId },
        data: {
          hasConflict: false,
          deviceId,
        },
      })

      expect(updateFileContentMock).toHaveBeenCalledWith({
        where: { id: fileContentId },
        data: {
          size: 1,
          version: '1',
          deviceId,
        },
      })
      expect(deleteObjectsSpy).toBeCalledTimes(1)
    })
  })

  describe('getFileContentById', () => {
    it('should get file content successfully', async () => {
      findFirstFileContent.mockResolvedValue(fileContent)

      const fileService = new FileService(prismaClient)
      await fileService.getFileContentById(userId, fileId, fileContent.id)

      expect(findFirstFileContent).toHaveBeenCalledWith({
        where: {
          id: fileContent.id,
          fileId,
          deleteAt: null,
          file: {
            user: {
              id: userId,
              deleteAt: null,
            },
          },
        },
        select: {
          id: true,
          name: true,
          size: true,
          status: true,
          version: true,
        },
      })
    })
  })

  describe('deleteFileContent', () => {
    it('should delete file content successfully', async () => {
      findFileFirstMock.mockResolvedValue({ size: 10000007 })
      updateFileMock.mockResolvedValue({})

      const fileService = new FileService(prismaClient)
      await fileService.deleteFileContent(userId, deviceId, fileId, fileContent)

      expect(findFileFirstMock).toHaveBeenCalledWith({
        where: {
          id: fileId,
          deleteAt: null,
          userId,
          user: { deleteAt: null },
        },
        select: { size: true },
      })

      expect(updateFileMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getFileContentsConflict', () => {
    it('should get conflict file contents successfully', async () => {
      const fileContentIds = [faker.datatype.uuid(), faker.datatype.uuid()]
      const conflictFiles = [
        {
          fileContentId: fileContentIds[0],
          name: 'data.json',
          version: '3',
        },
        {
          fileContentId: fileContentIds[0],
          name: 'data.json',
          version: '2',
        },
        {
          fileContentId: fileContentIds[0],
          name: 'data.json',
          version: '1',
        },
        {
          fileContentId: fileContentIds[1],
          name: 'media.dat',
          version: 'v2',
        },
        {
          fileContentId: fileContentIds[1],
          name: 'media.dat',
          version: 'v1',
        },
      ]
      findManyFileContentHistoryMock.mockResolvedValue(conflictFiles)

      const fileService = new FileService(prismaClient)
      const res = await fileService.getFileContentsConflict(fileId, userId)

      expect(findManyFileContentHistoryMock).toHaveBeenCalledWith({
        where: {
          fileId,
          status: FileStatus.UPLOADED,
          file: {
            userId,
            hasConflict: true,
            user: {
              deleteAt: null,
            },
          },
        },
        distinct: ['deviceId'],
        orderBy: { createdAt: 'desc' },
        select: {
          fileContentId: true,
          name: true,
          version: true,
        },
      })
      expect(res).toEqual([
        {
          id: fileContentIds[0],
          name: 'data.json',
          versions: ['3', '2', '1'],
        },
        {
          id: fileContentIds[1],
          name: 'media.dat',
          versions: ['v2', 'v1'],
        },
      ])
    })
  })
})
