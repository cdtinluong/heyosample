import { faker } from '@faker-js/faker'
import { Response } from '@layers/core/lib/response'
import { ConflictResolution, FileService } from '../services'
import { FileStatus, FileType } from '@layers/prisma'
import { CustomCode } from '@layers/core/lib/code'
import { MAX_FILE_SIZE } from '@layers/file'

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

const fileService = Object.getPrototypeOf(new FileService(prismaClient))
const getFileByIdSpy = jest.spyOn(fileService, 'getFileById')
const getFileWithContentsByIdSpy = jest.spyOn(fileService, 'getFileWithContentsById')
const upsertFileContentsSpy = jest.spyOn(fileService, 'upsertFileContents')
const uploadFilesSpy = jest.spyOn(fileService, 'uploadFiles')
const completeMultipartUploadSpy = jest.spyOn(fileService, 'completeMultipartUpload')
const abortMultipartUploadSpy = jest.spyOn(fileService, 'abortMultipartUpload')
const getFileContentByFileIdSpy = jest.spyOn(fileService, 'getFileContentByFileId')
const downloadFilesSpy = jest.spyOn(fileService, 'downloadFiles')
const resolveConflictSpy = jest.spyOn(fileService, 'resolveConflict')
const getConflictedFileContentsSpy = jest.spyOn(fileService, 'getConflictedFileContents')
const getFileContentByIdSpy = jest.spyOn(fileService, 'getFileContentById')
const deleteFileContentSpy = jest.spyOn(fileService, 'deleteFileContent')
const getFileThumbnailSpy = jest.spyOn(fileService, 'getFileThumbnail')
const getFileContentsConflictSpy = jest.spyOn(fileService, 'getFileContentsConflict')

const deviceId = faker.datatype.uuid()
const userId = faker.datatype.uuid()
const fileId = faker.datatype.uuid()
const event: any = { meta: { user: { id: userId }, deviceId } }
const file = {
  id: fileId,
  name: faker.datatype.string(),
  size: faker.datatype.bigInt(),
  checksum: faker.datatype.string(),
  version: 1,
  status: FileStatus.OPENED,
  hasConflict: false,
  deleteAt: null,
}

const fileContent = {
  id: faker.datatype.uuid(),
  name: 'media.dat',
  size: faker.datatype.bigInt(),
  status: FileStatus.ACTIVE,
  version: faker.datatype.string(),
}

describe('file/handlers', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('POST /file/{fileId}/download', () => {
    const names = [`${faker.commerce.productMaterial()}.dat`, `${faker.commerce.productMaterial()}.dat`]
    afterEach(() => {
      jest.resetAllMocks()
    })

    it('Return 200: Download files successfully', async () => {
      event.params = { fileContents: [], fileId }
      const fileContents = [fileContent]
      getFileByIdSpy.mockResolvedValue({ id: fileId, name: faker.datatype.string() })
      getFileContentByFileIdSpy.mockResolvedValue(fileContents)
      const contents = [
        {
          name: names[0],
          presignedUrls: [
            {
              presignedUrl: faker.datatype.string(),
              index: 1,
            },
          ],
        },
      ]
      downloadFilesSpy.mockResolvedValue(contents)

      const { postFileDownload } = await import('../handlers')
      const res = await postFileDownload.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual({ id: fileId, fileContents: contents })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_DOWNLOAD)
    })

    it('Return 200: Download files successfully', async () => {
      event.params = {
        fileContents: [
          { name: names[0], version: '1' },
          { name: names[1], version: '1' },
        ],
        fileId,
      }
      const fileContents = [
        {
          id: fileId,
          name: names[0],
          size: faker.datatype.bigInt(),
          version: faker.datatype.string(),
        },
      ]
      getFileByIdSpy.mockResolvedValue({ id: fileId, name: file.name })
      getFileContentByFileIdSpy.mockResolvedValue(fileContents)
      const contents = [
        {
          name: names[0],
          presignedUrls: [
            {
              presignedUrl: faker.datatype.string(),
              index: 1,
            },
          ],
        },
      ]
      downloadFilesSpy.mockResolvedValue(contents)

      const { postFileDownload } = await import('../handlers')
      const res = await postFileDownload.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual({ id: fileId, fileContents: contents })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_DOWNLOAD)
    })

    it('Returns 404: No file contents found', async () => {
      getFileByIdSpy.mockResolvedValue({ id: faker.datatype.uuid(), name: faker.datatype.string() })
      getFileContentByFileIdSpy.mockResolvedValue(undefined)

      const { postFileDownload } = await import('../handlers')
      const res = await postFileDownload.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_CONTENT_NOT_FOUND)
    })
  })

  describe('POST /file/{fileId}/upload', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const name = faker.datatype.string()
    const fileContentName = faker.datatype.string()

    it('should upload file successfully', async () => {
      event.params = { fileId, fileContents: [{ name: fileContentName, size: 5 }] }
      const uploadId = faker.datatype.string()
      const presignedUrls = [faker.datatype.string()]
      getFileByIdSpy.mockResolvedValueOnce({ id: fileId, name: name })
      upsertFileContentsSpy.mockResolvedValueOnce({})
      uploadFilesSpy.mockResolvedValueOnce([{ name: fileContentName, uploadId, presignedUrls }])

      const { postFileUpload } = await import('../handlers')
      const res = await postFileUpload.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual({
        id: fileId,
        name,
        fileContents: [{ uploadId, presignedUrls, name: fileContentName }],
      })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_UPLOAD)
    })

    it('should upload file failed - file not found', async () => {
      getFileByIdSpy.mockResolvedValueOnce(undefined)

      const { postFileUpload } = await import('../handlers')
      const res = await postFileUpload.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_NOT_FOUND)
    })

    it('should upload file failed - file size exceeded', async () => {
      event.params = { fileId, fileContents: [{ name: fileContentName, size: MAX_FILE_SIZE + 1 }] }

      const { postFileUpload } = await import('../handlers')
      const res = await postFileUpload.handler(event, ctx)

      expect(res.statusCode).toEqual(403)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_SIZE_EXCEEDED)
    })
  })

  describe('POST /file/{fileId}/upload/complete', () => {
    const name = faker.datatype.string()
    const uploadId = faker.datatype.string()
    const parts = [{ ETag: faker.datatype.string(), PartNumber: 1 }]

    it('should complete upload successfully', async () => {
      event.params = { fileId, fileContents: [{ uploadId, name, parts }] }
      getFileByIdSpy.mockResolvedValueOnce({ id: fileId, name: name })
      completeMultipartUploadSpy.mockResolvedValueOnce({ successes: [], failures: [] })
      getConflictedFileContentsSpy.mockResolvedValue([])

      const { postFileUploadComplete } = await import('../handlers')

      const res = await postFileUploadComplete.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual({ successes: [], failures: [], conflictedFileContents: [] })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_UPLOAD_COMPLETED)
    })

    it('should complete uploading successfully - with conflicted files', async () => {
      const conflictedFile = {
        id: faker.datatype.uuid(),
        name: 'media.dat',
        size: faker.datatype.bigInt(),
        status: FileStatus.UPLOADING,
        version: faker.datatype.string(),
      }
      event.params = { fileId, fileContents: [{ uploadId, name, parts }] }
      getFileByIdSpy.mockResolvedValueOnce({ id: fileId, name: name })
      completeMultipartUploadSpy.mockResolvedValueOnce({ successes: [], failures: [] })
      getConflictedFileContentsSpy.mockResolvedValue([conflictedFile])

      const { postFileUploadComplete } = await import('../handlers')

      const res = await postFileUploadComplete.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual({
        successes: [],
        failures: [],
        conflictedFileContents: [{ ...conflictedFile, size: Number(conflictedFile.size) }],
      })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_UPLOAD_COMPLETED)
    })

    it('file not found', async () => {
      getFileByIdSpy.mockResolvedValueOnce(null)
      const { postFileUploadComplete } = await import('../handlers')
      const res = await postFileUploadComplete.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_NOT_FOUND)
    })
  })

  describe('POST /file/{fileId}/upload/abort', () => {
    const name = faker.datatype.string()
    const fileContentName = faker.datatype.string()
    const uploadId = faker.datatype.string()

    it('should abort uploading successfully', async () => {
      event.params = { fileId, fileContents: [{ uploadId, name: fileContentName }] }
      getFileByIdSpy.mockResolvedValueOnce({ id: fileId, name: name })
      abortMultipartUploadSpy.mockResolvedValueOnce({})

      const { postFileUploadAbort } = await import('../handlers')
      const res = await postFileUploadAbort.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_UPLOAD_ABORTED)
    })

    it('should abort uploading successfully', async () => {
      getFileByIdSpy.mockResolvedValueOnce(null)
      const { postFileUploadAbort } = await import('../handlers')
      const res = await postFileUploadAbort.handler(event, ctx)
      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_NOT_FOUND)
    })
  })

  describe('GET /file/{fileId}', () => {
    it('Return 200: should get file info successfully', async () => {
      event.params = { fileId }
      const thumbnailFile = {
        id: faker.datatype.uuid(),
        name: 'Thumbnail.png',
        size: 10000,
        status: 'ACTIVE',
        version: '1.0',
      }
      getFileWithContentsByIdSpy.mockResolvedValue({
        ...file,
        type: FileType.VECTORNATOR,
        contents: [fileContent, thumbnailFile],
      })
      const thumbnailUrl =
        'https://eu-central-1.s3.amazonaws.com/thumbnail.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=aaa%2F20221129%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Date=20221129T140309Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=aaa'
      getFileThumbnailSpy.mockResolvedValue(thumbnailUrl)
      const expectedResult = {
        ...file,
        size: String(file.size),
        type: 'vectornator',
        contents: [
          { ...fileContent, size: Number(fileContent.size) },
          { ...thumbnailFile, size: Number(thumbnailFile.size) },
        ],
        thumbnail: thumbnailUrl, // thumbnail url
      }

      const { getFile } = await import('../handlers')
      const res = await getFile.handler(event, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).data).toEqual(expectedResult)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_RETRIEVED)
      expect(getFileThumbnailSpy).toBeCalledWith(event.meta.user.id, { ...thumbnailFile, fileId })
    })

    it('Return 404: file not found', async () => {
      getFileWithContentsByIdSpy.mockResolvedValue(null)

      const { getFile } = await import('../handlers')
      const res = await getFile.handler(event, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_NOT_FOUND)
    })
  })

  describe('POST /file/{fileId}/conflict/resolve', () => {
    it('Return 200: should resolve file conflict successfully', async () => {
      getFileByIdSpy.mockResolvedValue(file)
      resolveConflictSpy.mockResolvedValue({})

      const { postFileConflictResolve } = await import('../handlers')
      const res = await postFileConflictResolve.handler(
        { ...event, params: { fileId, resolution: ConflictResolution.DOWNLOAD_CHANGE } },
        ctx,
      )

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body))).toEqual({
        data: {},
        message: 'File resolved',
        code: CustomCode.FILE_CONFLICT_RESOLVED,
      })
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_CONFLICT_RESOLVED)
    })

    it('Return 404: file not found', async () => {
      getFileByIdSpy.mockResolvedValue(null)

      const { postFileConflictResolve } = await import('../handlers')
      const res = await postFileConflictResolve.handler(
        { ...event, params: { fileId, keepingFiles: [], deletingFiles: [] } },
        ctx,
      )

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_NOT_FOUND)
    })
  })

  describe('POST /file/{fileId}/content/{fileContentId}', () => {
    it('Return 200: should delete file content successfully', async () => {
      getFileContentByIdSpy.mockResolvedValue(fileContent)
      deleteFileContentSpy.mockResolvedValue(undefined)

      const { deleteFileContent } = await import('../handlers')
      const res = await deleteFileContent.handler({ ...event, params: { fileId, fileContentId: fileContent.id } }, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body))).toEqual({
        data: {},
        message: 'File content deleted',
        code: CustomCode.FILE_CONTENT_DELETED,
      })
    })

    it('Return 404: should delete file content successfully', async () => {
      getFileContentByIdSpy.mockResolvedValue(null)

      const { deleteFileContent } = await import('../handlers')
      const res = await deleteFileContent.handler({ ...event, params: { fileId, fileContentId: fileContent.id } }, ctx)

      expect(res.statusCode).toEqual(404)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_CONTENT_NOT_FOUND)
    })
  })

  describe('GET /file/{fileId}/conflict', () => {
    it('Return 200: should get conflict file successfully', async () => {
      getFileContentsConflictSpy.mockResolvedValue([])

      const { getFileConflict } = await import('../handlers')
      const res = await getFileConflict.handler({ ...event, params: { fileId, fileContentId: fileContent.id } }, ctx)

      expect(res.statusCode).toEqual(200)
      expect(JSON.parse(String(res.body)).code).toEqual(CustomCode.FILE_CONFLICT_RETRIEVED)
    })
  })
})
