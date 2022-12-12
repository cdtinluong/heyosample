import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { isEmpty } from 'lodash'
import { CreateHttpHandlerWithAuthOptions } from 'packages/layers/core/nodejs/lib/http-handler'
import { CustomCode } from '@layers/core/lib/code'
import { MAX_FILE_SIZE } from '@layers/file'
import { ConflictResolution, FileService, thumbnailFileName } from './services'
import {
  FileContentUpload,
  FileContentUploadComplete,
  FileContentUploadAbort,
  ConflictResolutionRequest,
  FileDownloadRequest,
} from './models'
import { getFileTypeResponse } from './utils'

export const postFileDownload: CreateHttpHandlerWithAuthOptions<{
  fileId: string
  fileContents: FileDownloadRequest[]
}> = {
  name: 'postFileDownload',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const fileService = new FileService(ctx.prisma)
    const { id } = event.meta.user
    const { fileId, fileContents } = event.params

    const contents = await fileService.getFileContentByFileId(
      id,
      fileId,
      fileContents.map((c) => c.name),
    )
    if (isEmpty(contents)) {
      return ctx.res.NotFound(
        JSON.stringify({ message: 'File contents not found', code: CustomCode.FILE_CONTENT_NOT_FOUND }),
      )
    }

    // eslint-disable-next-line consistent-return
    contents.forEach((content) => {
      const fileContent = fileContents.find((f) => f.name === content.name)
      if (fileContent) {
        // eslint-disable-next-line no-param-reassign
        content.version = fileContent.version
      }
    })

    const files = await fileService.downloadFiles(id, fileId, contents)
    return ctx.res.Ok({
      data: { id: fileId, fileContents: files },
      code: CustomCode.FILE_DOWNLOAD,
      message: 'File contents download can be started',
    })
  },
}

export const postFileUpload: CreateHttpHandlerWithAuthOptions<{ fileContents: FileContentUpload[]; fileId: string }> = {
  name: 'postFileUpload',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const fileService = new FileService(ctx.prisma)
    const { fileId, fileContents } = event.params
    const {
      deviceId,
      user: { id },
    } = event.meta

    const isFileSizeExceeded = fileContents.some((content) => content.size > MAX_FILE_SIZE)

    if (isFileSizeExceeded) {
      return ctx.res.Forbidden(JSON.stringify({ message: 'File size exceeded', code: CustomCode.FILE_SIZE_EXCEEDED }))
    }

    const file = await fileService.getFileById(fileId, id)
    if (!file) {
      return ctx.res.NotFound(JSON.stringify({ message: 'File not found', code: CustomCode.FILE_NOT_FOUND }))
    }

    const result = await fileService.uploadFiles(id, fileId, deviceId, fileContents)
    await fileService.upsertFileContents(deviceId, fileId, fileContents)

    return ctx.res.Ok({
      data: {
        id: fileId,
        name: file.name,
        fileContents: result,
      },
      code: CustomCode.FILE_UPLOAD,
      message: 'File contents upload can be started',
    })
  },
}

export const postFileUploadComplete: CreateHttpHandlerWithAuthOptions<{
  fileId: string
  fileContents: FileContentUploadComplete[]
}> = {
  name: 'postFileUploadComplete',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { fileId, fileContents } = event.params
    const fileService = new FileService(ctx.prisma)
    const file = await fileService.getFileById(fileId, event.meta.user.id)

    if (!file) {
      return ctx.res.NotFound(JSON.stringify({ message: 'File not found', code: CustomCode.FILE_NOT_FOUND }))
    }

    const {
      deviceId,
      user: { id },
    } = event.meta

    const conflictedFileContents = await fileService.getConflictedFileContents(id, deviceId, fileId, fileContents)

    const res = await fileService.completeMultipartUpload(
      id,
      fileId,
      deviceId,
      !isEmpty(conflictedFileContents),
      fileContents,
    )
    return ctx.res.Ok({
      data: {
        ...res,
        conflictedFileContents: conflictedFileContents.map((fileContent) => ({
          ...fileContent,
          size: Number(fileContent.size),
        })),
      },
      message: 'Upload completed',
      code: CustomCode.FILE_UPLOAD_COMPLETED,
    })
  },
}

export const postFileUploadAbort: CreateHttpHandlerWithAuthOptions<{
  fileId: string
  fileContents: FileContentUploadAbort[]
}> = {
  name: 'postFileUploadAbort',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { fileId } = event.params
    const fileService = new FileService(ctx.prisma)
    const file = await fileService.getFileById(fileId, event.meta.user.id)

    if (!file) {
      return ctx.res.NotFound(JSON.stringify({ message: 'File not found', code: CustomCode.FILE_NOT_FOUND }))
    }

    await fileService.abortMultipartUpload(event.meta.user.id, fileId, event.params.fileContents)
    return ctx.res.Ok({ message: 'Upload aborted', code: CustomCode.FILE_UPLOAD_ABORTED, data: {} })
  },
}

export const getFile: CreateHttpHandlerWithAuthOptions<{ fileId: string }> = {
  name: 'getFile',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const fileService = new FileService(ctx.prisma)
    const { fileId } = event.params
    const file = await fileService.getFileWithContentsById(fileId, event.meta.user.id)

    if (!file) {
      return ctx.res.NotFound(JSON.stringify({ message: 'File not found', code: CustomCode.FILE_NOT_FOUND }))
    }

    const contents = file.contents.map((content) => ({
      ...content,
      size: Number(content.size),
    }))

    const thumbnailFile = file.contents.find((fileContent) => fileContent.name === thumbnailFileName)

    const thumbnailUrl =
      thumbnailFile == null
        ? undefined
        : await fileService.getFileThumbnail(event.meta.user.id, { ...thumbnailFile, fileId })

    return ctx.res.Ok({
      data: {
        ...file,
        size: String(file.size),
        type: getFileTypeResponse(file.type),
        contents,
        thumbnail: thumbnailUrl,
      },
      message: 'File retrieved',
      code: CustomCode.FILE_RETRIEVED,
    })
  },
}

export const postFileConflictResolve: CreateHttpHandlerWithAuthOptions<{
  fileId: string
  resolution: ConflictResolution
  fileContents: ConflictResolutionRequest[]
}> = {
  name: 'postFileConflictResolve',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { fileId, resolution } = event.params
    const {
      deviceId,
      user: { id },
    } = event.meta
    const fileService = new FileService(ctx.prisma)
    const file = await fileService.getFileById(fileId, id)

    if (!file) {
      return ctx.res.NotFound(JSON.stringify({ message: 'File not found', code: CustomCode.FILE_NOT_FOUND }))
    }

    await fileService.resolveConflict(id, fileId, deviceId, resolution, event.params.fileContents)

    return ctx.res.Ok({
      data: {},
      message: 'File resolved',
      code: CustomCode.FILE_CONFLICT_RESOLVED,
    })
  },
}

export const deleteFileContent: CreateHttpHandlerWithAuthOptions<{
  fileId: string
  fileContentId: string
}> = {
  name: 'deleteFileContent',
  withDb: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const { fileId, fileContentId } = event.params
    const {
      deviceId,
      user: { id },
    } = event.meta
    const fileService = new FileService(ctx.prisma)
    const fileContent = await fileService.getFileContentById(id, fileId, fileContentId)

    if (!fileContent) {
      return ctx.res.NotFound(
        JSON.stringify({ message: 'File content not found', code: CustomCode.FILE_CONTENT_NOT_FOUND }),
      )
    }

    await fileService.deleteFileContent(id, deviceId, fileId, fileContent)

    return ctx.res.Ok({
      data: {},
      message: 'File content deleted',
      code: CustomCode.FILE_CONTENT_DELETED,
    })
  },
}

export const getFileConflict: CreateHttpHandlerWithAuthOptions<{
  fileId: string
}> = {
  name: 'getFileConflict',
  withDb: true,
  isReadOnly: true,
  async handler(event, ctx): Promise<APIGatewayProxyStructuredResultV2> {
    const fileService = new FileService(ctx.prisma)
    const conflictedFileContents = await fileService.getFileContentsConflict(event.params.fileId, event.meta.user.id)

    return ctx.res.Ok({
      data: conflictedFileContents,
      message: 'File conflict retrieved',
      code: CustomCode.FILE_CONFLICT_RETRIEVED,
    })
  },
}
