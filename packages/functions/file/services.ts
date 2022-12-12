import { FileStatus, Prisma, PrismaClient } from '@layers/prisma'
import { PrismaService } from '@layers/prisma/prisma.svc'
import { keyBy, differenceBy } from 'lodash'
import env from 'cdk/lib/env'
import { FileHelper } from '@layers/file'
import {
  FileContentHistorySelect,
  FileContentUpload,
  FileContentUploadAbort,
  FileContentUploadComplete,
  FileCreationResponse,
  FileDownloadResponse,
  FileSelect,
  FileSelectWithContents,
  FileUploadResponse,
  FileContentSelect,
  CompletedUploading,
  CompleteUploadResult,
  ConflictResolutionRequest,
  ConflictFileResponse,
} from './models'
import { getFileType } from './utils'

// this is harded code
export const thumbnailFileName = 'Thumbnail.png'

enum PROMISE_STATUS {
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

export enum ConflictResolution {
  DOWNLOAD_CHANGE,
  KEEP_CHANGE,
  CREATE_TWO_FILES,
}

export class FileService extends PrismaService {
  private fileHelper: FileHelper

  public constructor(prismaClient: PrismaClient) {
    super(prismaClient)
    this.fileHelper = new FileHelper()
  }

  public async createFile(
    userId: string,
    orgId: string,
    folder: string,
    name: string,
    size: string,
    fileType: string,
    deviceId: string,
  ): Promise<FileCreationResponse> {
    const type = getFileType(fileType)

    return this.client.file.create({
      data: {
        size: BigInt(size),
        user: { connect: { id: userId } },
        name,
        organization: { connect: { id: orgId } },
        checksum: '',
        status: FileStatus.CLOSED,
        deviceId,
        type,
        hierarchy: {
          create: {
            path: `${folder}${name}`,
            userId,
            deviceId,
            status: FileStatus.ACTIVE,
            type,
          },
        },
      },
      select: {
        hierarchy: true,
      },
    })
  }

  public async getFilesThumbnail(
    userId: string,
    fileIds: string[],
    getTrashed = false,
  ): Promise<Map<string, string | null>> {
    // load file content from db
    const fileContents = await this.client.fileContent.findMany({
      where: {
        name: thumbnailFileName,
        deleteAt: getTrashed === true ? { not: null } : null,
        file: {
          userId,
          id: {
            in: fileIds,
          },
        },
      },
      select: {
        name: true,
        id: true,
        fileId: true,
        version: true,
      },
    })
    const fileThumbnails = await Promise.all(
      fileContents.map(async (fileContent) =>
        Promise.all([Promise.resolve(fileContent.fileId), this.getFileThumbnail(userId, fileContent)]),
      ),
    )
    return new Map(fileThumbnails)
  }

  public async getFileContentByFileId(
    userId: string,
    fileId: string,
    fileContents?: string[],
  ): Promise<FileContentSelect[]> {
    let conditionContent

    if (fileContents !== undefined && fileContents.length > 0) {
      conditionContent = {
        in: fileContents,
      }
    }

    return this.client.fileContent.findMany({
      where: {
        fileId,
        name: conditionContent,
        deleteAt: null,
        file: {
          userId,
          user: {
            deleteAt: null,
          },
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
  }

  public async downloadFiles(
    userId: string,
    fileId: string,
    fileContents: FileContentSelect[],
  ): Promise<FileDownloadResponse[]> {
    const getPresignedUrlsFuncs = fileContents.map(async (fileContent) => {
      const { presignedUrls, chunkSize } = await this.fileHelper.downloadMultipart(
        env.MRAP_ARN,
        this.buildFileKey(userId, fileId, fileContent.name),
        Number(fileContent.size),
        fileContent.version,
      )

      return {
        name: fileContent.name,
        version: fileContent.version,
        presignedUrls,
        chunkSize,
      }
    })

    return Promise.all(getPresignedUrlsFuncs)
  }

  public async getFileById(id: string, userId: string): Promise<FileSelect | null> {
    return this.client.file.findFirst({
      where: {
        id,
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
      },
    })
  }

  public async getFileWithContentsById(id: string, userId: string): Promise<FileSelectWithContents | null> {
    return this.client.file.findFirst({
      where: {
        id,
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
  }

  /**
   * get file thumbnail
   *
   * @param fileId file id
   * @param thumbnailFile content of the file
   */
  public async getFileThumbnail<T extends { fileId: string; id: string; name: string; version: string }>(
    userId: string,
    thumbnailFile?: T,
  ): Promise<string | null> {
    if (thumbnailFile == null) return null
    // get presigned url
    return this.fileHelper.downloadFile(
      env.MRAP_ARN,
      this.buildFileKey(userId, thumbnailFile.fileId, thumbnailFile.name),
      thumbnailFile.version,
    )
  }

  public async upsertFileContents(deviceId: string, fileId: string, fileContents: FileContentUpload[]): Promise<void> {
    const upsertFuncs = fileContents.map(
      (fileContent) =>
        this.client.$executeRaw`INSERT INTO "FileContent" ("id", "file_id", "name", "size", "status", "device_id")
            VALUES (uuid_generate_v4(), uuid(${fileId}), ${fileContent.name}, ${fileContent.size}, 'UPLOADING', ${deviceId})
            ON CONFLICT ON CONSTRAINT "FileContent_file_id_name_key"
            DO UPDATE SET "status" = 'UPLOADING', "size" = ${fileContent.size}, "device_id" = ${deviceId}, "delete_at" = null`,
    )

    await Promise.all(upsertFuncs)
  }

  public async uploadFiles(
    userId: string,
    fileId: string,
    deviceId: string,
    fileContents: FileContentUpload[],
  ): Promise<FileUploadResponse[]> {
    const presignedUrlsFuncs = fileContents.map(async (fileContent) => {
      const { uploadId, presignedUrls, chunkSize } = await this.fileHelper.uploadMultipart(
        env.MRAP_ARN,
        this.buildFileKey(userId, fileId, fileContent.name),
        fileContent.size,
      )

      return {
        name: fileContent.name,
        uploadId,
        presignedUrls,
        chunkSize,
      }
    })

    await this.client.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.UPLOADING,
        deviceId,
        contents: {
          updateMany: {
            where: {
              name: { in: fileContents.map((c) => c.name) },
              deleteAt: null,
            },
            data: {
              status: FileStatus.UPLOADING,
              deviceId,
            },
          },
        },
      },
    })

    return Promise.all(presignedUrlsFuncs)
  }

  public async completeMultipartUpload(
    userId: string,
    fileId: string,
    deviceId: string,
    hasConflict: boolean,
    fileContents: FileContentUploadComplete[],
  ): Promise<CompleteUploadResult> {
    const promises = fileContents.map(async (content) =>
      this.fileHelper.completeMultipartUpload(
        env.MRAP_ARN,
        content.uploadId,
        this.buildFileKey(userId, fileId, content.name),
        content.parts,
      ),
    )

    const results = await Promise.allSettled(promises)
    const isAllSuccess = results.every((r) => r.status === PROMISE_STATUS.FULFILLED)
    const completedUploadFiles = results.reduce((acc, curr) => {
      if (curr.status === PROMISE_STATUS.FULFILLED) {
        acc.push({
          name: this.extractFilenameFromS3Key(curr.value.Key as string),
          version: curr.value.VersionId as string,
        })
      }
      return acc
    }, [] as CompletedUploading[])

    const completedUploadFilenames = completedUploadFiles.map((c) => c.name)
    const completedUploadFilesMap = keyBy(completedUploadFiles, 'name')

    const fileContentsList = await this.client.fileContent.findMany({
      where: {
        fileId,
        status: { notIn: [FileStatus.ABORTED, FileStatus.FAILED] },
        deleteAt: null,
      },
      select: {
        id: true,
        name: true,
        size: true,
      },
    })
    const fileContentsMap = keyBy(fileContentsList, 'name')

    // merge data since we get file contents from the read instance
    const uncompletedUploadFiles = fileContents.reduce((acc, curr) => {
      if (!completedUploadFilenames.includes(curr.name)) {
        acc.push(curr.name)
      }

      return acc
    }, [] as string[])
    const uploadedFileContents = fileContentsList.filter(
      (fileContent) => !uncompletedUploadFiles.includes(fileContent.name),
    )
    const totalSize = uploadedFileContents.reduce((acc, fileContent) => acc + Number(fileContent.size), 0)

    const fileContentUpdatingFuncs = completedUploadFiles.map((fileContent) =>
      this.client.fileContent.update({
        where: { id: fileContentsMap[fileContent.name].id },
        data: {
          version: completedUploadFilesMap[fileContent.name].version,
          status: FileStatus.UPLOADED,
          deviceId,
        },
      }),
    )
    const fileUpdatingFunc = this.client.file.update({
      where: { id: fileId },
      data: {
        status: isAllSuccess ? FileStatus.UPLOADED : FileStatus.UPLOADING,
        size: totalSize,
        deviceId,
        hasConflict,
      },
    })

    await this.client.$transaction([...fileContentUpdatingFuncs, fileUpdatingFunc])

    if (isAllSuccess) {
      // No failed completion upload
      return {
        successes: completedUploadFiles,
        failures: [],
      }
    }

    // Failed completion upload files
    const failures = fileContents.reduce((acc, curr) => {
      if (!completedUploadFilenames.includes(curr.name)) {
        acc.push(curr.name)
      }

      return acc
    }, [] as string[])

    return {
      successes: completedUploadFiles,
      failures,
    }
  }

  public async abortMultipartUpload(
    userId: string,
    fileId: string,
    fileContents: FileContentUploadAbort[],
  ): Promise<void> {
    const promises = fileContents.map(async (content) =>
      this.fileHelper.abortMultipartUpload(
        env.MRAP_ARN,
        content.uploadId,
        this.buildFileKey(userId, fileId, content.name),
      ),
    )

    await this.client.file.update({
      where: { id: fileId },
      data: {
        status: FileStatus.ABORTED,
        contents: {
          updateMany: {
            where: {
              name: { in: fileContents.map((file) => file.name) },
              deleteAt: null,
            },
            data: { status: FileStatus.ABORTED },
          },
        },
      },
    })

    await Promise.all(promises)
  }

  public async getConflictedFileContents(
    userId: string,
    deviceId: string,
    fileId: string,
    fileContents: Array<{ name: string; version: string }>,
  ): Promise<FileContentSelect[]> {
    const contents = await this.client.fileContent.findMany({
      where: {
        fileId,
        name: { in: fileContents.map((fileContent) => fileContent.name) },
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

    const conflictedContents = contents.filter((content) =>
      fileContents.find((fileContent) => content.version !== fileContent.version && content.name === fileContent.name),
    )

    const uploadingFilesFromOtherDevice = await this.client.fileContentHistory.findMany({
      where: {
        fileId,
        status: FileStatus.UPLOADING,
        deviceId: { not: deviceId },
        fileContentId: { in: differenceBy(contents, conflictedContents, 'id').map((content) => content.id) },
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

    return uploadingFilesFromOtherDevice
      .map((uploadingFile) => ({
        id: uploadingFile.fileContentId,
        name: uploadingFile.name,
        size: uploadingFile.size,
        version: uploadingFile.version,
        status: uploadingFile.status,
      }))
      .concat(conflictedContents)
  }

  public async resolveConflict(
    userId: string,
    fileId: string,
    deviceId: string,
    conflictResolution: ConflictResolution,
    fileContents: ConflictResolutionRequest[],
  ): Promise<void> {
    const keepingFiles: FileContentHistorySelect[] = await this.client
      .$queryRaw`SELECT "file_content_id", "name", "version", "size" FROM "FileContentHistory"
        WHERE file_id = uuid(${fileId}) AND "status" = 'UPLOADED' AND "name" IN 
        (${Prisma.join(fileContents.map((r) => r.name))}) 
        AND "version" IN (${Prisma.join(fileContents.map((r) => r.keepingVersion))})`

    const fileContentUpdatingFuncs = keepingFiles.map((keepingFile) =>
      this.client.fileContent.update({
        where: { id: keepingFile.file_content_id },
        data: {
          size: keepingFile.size,
          version: keepingFile.version,
          deviceId,
        },
      }),
    )

    const fileUpdatingFunc = this.client.file.update({
      where: { id: fileId },
      data: {
        hasConflict: false,
        deviceId,
      },
    })

    await this.client.$transaction([...fileContentUpdatingFuncs, fileUpdatingFunc])

    if (conflictResolution !== ConflictResolution.CREATE_TWO_FILES) {
      await this.fileHelper.deleteObjects(
        env.MRAP_ARN,
        fileContents.map((fileContent) => ({
          key: this.buildFileKey(userId, fileId, fileContent.name),
          version: fileContent.deletingVersion,
        })),
      )
    }
  }

  public async getFileContentById(userId: string, fileId: string, id: string): Promise<FileContentSelect | null> {
    return this.client.fileContent.findFirst({
      where: {
        id,
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
  }

  public async deleteFileContent(
    userId: string,
    deviceId: string,
    fileId: string,
    fileContent: FileContentSelect,
  ): Promise<void> {
    const file = await this.client.file.findFirst({
      where: {
        id: fileId,
        deleteAt: null,
        userId,
        user: { deleteAt: null },
      },
      select: { size: true },
    })

    await this.client.file.update({
      where: { id: fileId },
      data: {
        size: Number(file?.size) - Number(fileContent.size),
        deviceId,
        contents: {
          update: {
            where: { id: fileContent.id },
            data: {
              deleteAt: new Date(),
              deviceId,
            },
          },
        },
      },
    })
  }

  public async getFileContentsConflict(fileId: string, userId: string): Promise<ConflictFileResponse[]> {
    const conflictedFileContents = await this.client.fileContentHistory.findMany({
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

    return conflictedFileContents.reduce((acc, curr) => {
      const existingFileContent = acc.find((f) => f.id === curr.fileContentId)

      if (!existingFileContent) {
        acc.push({ id: curr.fileContentId, name: curr.name, versions: [curr.version] })
      } else {
        existingFileContent.versions.push(curr.version)
      }

      return acc
    }, [] as ConflictFileResponse[])
  }

  private extractFilenameFromS3Key(key: string): string {
    const idx = key.lastIndexOf('/')
    return key.slice(idx + 1, key.length)
  }

  private buildFileKey(userId: string, fileId: string, fileContentName: string) {
    return `${userId}/${fileId}/${fileContentName}`
  }
}
