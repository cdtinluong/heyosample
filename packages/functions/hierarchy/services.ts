import { PrismaService } from '@layers/prisma/prisma.svc'
import { normalizePath, getFileType, getFileTypeResponse } from 'file/utils'
import { isEmpty, chain } from 'lodash'
import { FileStatus, Prisma, FileType } from '@layers/prisma'
import { v4 as uuidV4 } from 'uuid'
import {
  BatchHierarchyItem,
  FileRenameResponse,
  HierarchyCreationResponse,
  HierarchySelect,
  HierarchyTree,
  HierarchyTreeAndFilesResponse,
  HierarchyUpdateResponse,
  UserHierarchySelect,
  File,
} from './models'

const FILE_EXTENSIONS = ['.vectornator', '.animator']
const regexFileName = /[^\\/]+\.(vectornator|animator){1}$/

interface CountData {
  count: bigint
}

export class HierarchyService extends PrismaService {
  public async isValidHierarchy(
    userId: string,
    pathEndingWithoutSlash: string,
    includeCurrentPath = false,
  ): Promise<boolean> {
    const paths = this.splitHierarchy(pathEndingWithoutSlash)

    // Root folder
    if (paths.length === 1 && !includeCurrentPath) {
      return true
    }

    // Remove last path, because this path is going to be create
    if (!includeCurrentPath) {
      paths.pop()
    }

    const hierarchies = await this.client.hierarchy.findMany({
      where: {
        userId,
        path: { in: paths },
        deleteAt: null,
        user: {
          deleteAt: null,
        },
      },
      select: {
        id: true,
      },
    })

    return hierarchies.length === paths.length
  }

  public async getHierarchyByPath(userId: string, path: string): Promise<HierarchySelect | null> {
    return this.getHierarchy({
      path,
      userId,
      deleteAt: null,
      user: {
        deleteAt: null,
      },
    })
  }

  public async getHierarchyById(id: string, userId: string): Promise<HierarchySelect | null> {
    return this.getHierarchy({
      id,
      userId,
      deleteAt: null,
      user: {
        deleteAt: null,
      },
    })
  }

  public async getHierarchyTrashedById(id: string, userId: string): Promise<HierarchySelect | null> {
    return this.getHierarchy({
      id,
      userId,
      deleteAt: { not: null },
      user: {
        deleteAt: null,
      },
    })
  }

  public async countHierarchyTrashByPath(userId: string, path: string, isFile: boolean): Promise<number> {
    let pathCondition = `${path.substring(0, path.length - 1)} %[0-9]/`
    if (isFile) {
      const resultRegexNewFileName = regexFileName.exec(path)
      pathCondition = ''
      if (resultRegexNewFileName !== null && !isEmpty(resultRegexNewFileName.at(0))) {
        const [fileName, fileType] = resultRegexNewFileName.at(0)?.split('.') ?? ['', '']
        pathCondition = path.replace(resultRegexNewFileName.at(0) ?? '', `${fileName} %[0-9].${fileType}`)
      }
    }
    const result: [CountData] = await this.client
      .$queryRaw`SELECT count("Hierarchy"."path") FROM "Hierarchy" INNER JOIN "User" 
      ON "Hierarchy"."user_id" = "User".id 
      WHERE ("Hierarchy"."path" SIMILAR TO 
      ${pathCondition} or "Hierarchy"."path" = ${path})
      AND "Hierarchy"."delete_at" IS NOT NULL
      AND "User"."delete_at" IS NOT NULL
      AND "user_id"::text = ${userId};`
    if (result !== undefined && result.length > 0) {
      return Number(result[0].count)
    }
    return 0
  }

  /** This is a function will change path if the path is duplicated before action delete. */
  public async changeDuplicatedNameDeleteFlow(
    hierarchy: HierarchySelect,
    userId: string,
    deviceId: string,
  ): Promise<HierarchySelect> {
    const countHierarchyTrash = await this.countHierarchyTrashByPath(userId, hierarchy.path, hierarchy.fileId !== null)
    let hierarchyResult: HierarchySelect | null = hierarchy
    if (countHierarchyTrash > 0) {
      const maxNumber = countHierarchyTrash + 1
      let newPath = ''
      if (hierarchy.fileId === null) {
        const removeLastSlashPath = hierarchy.path.substring(0, hierarchy.path.length - 1)
        newPath = `${removeLastSlashPath} ${maxNumber}/`
      } else {
        const resultRegexNewFileName = regexFileName.exec(hierarchy.path)
        if (resultRegexNewFileName !== null && resultRegexNewFileName.at(0) !== undefined) {
          const [fileName, fileType] = resultRegexNewFileName.at(0)?.split('.') ?? ['', '']
          newPath = `${fileName} ${maxNumber}.${fileType}`
        }
      }
      await this.updatePathHierarchy(userId, newPath, hierarchy.path, hierarchy.fileId !== null, deviceId)
      hierarchyResult = await this.getHierarchyById(hierarchy.id, userId)
    }
    return hierarchyResult !== null ? hierarchyResult : hierarchy
  }

  public async createHierarchy(userId: string, path: string, deviceId: string): Promise<HierarchyCreationResponse> {
    const { withSlash } = normalizePath(path)

    return this.client.hierarchy.create({
      data: {
        path: withSlash,
        userId,
        deviceId,
        status: FileStatus.ACTIVE,
      },
      select: {
        id: true,
        path: true,
        fileId: true,
      },
    })
  }

  public async renameFile(fileId: string, newFileName: string, deviceId: string): Promise<FileRenameResponse> {
    return this.client.file.update({
      data: {
        name: newFileName,
        deviceId,
      },
      where: {
        id: fileId,
      },
      select: {
        id: true,
      },
    })
  }

  public async updatePathHierarchy(
    userId: string,
    newPath: string,
    oldPath: string,
    isUpdateFile: boolean,
    deviceId: string,
  ): Promise<HierarchyUpdateResponse[]> {
    const normalizeNewPath = normalizePath(newPath)
    const normalizeOldPath = normalizePath(oldPath)
    const pathUpdate = isUpdateFile ? normalizeNewPath.withoutSlash : normalizeNewPath.withSlash
    const oldPathQuery = isUpdateFile ? normalizeOldPath.withoutSlash : normalizeOldPath.withSlash

    const oldPathCondition = `${oldPathQuery}%`

    const [rowUpdate] = await this.client.$transaction([
      this.client
        .$executeRaw`UPDATE "Hierarchy" SET path = replace(path, ${oldPathQuery}, ${pathUpdate}), "device_id" = ${deviceId} 
          FROM "User" WHERE "Hierarchy"."user_id" = "User".id AND 
               "User"."delete_at" IS NULL AND 
               "Hierarchy".path like ${oldPathCondition} AND 
               "Hierarchy"."delete_at" IS NULL AND 
               "user_id"::text = ${userId};`,
    ])
    if (rowUpdate === 0) {
      return []
    }

    return this.client.hierarchy.findMany({
      where: {
        userId,
        path: {
          startsWith: pathUpdate,
        },
        user: {
          deleteAt: null,
        },
      },
      select: {
        id: true,
        path: true,
      },
    })
  }

  public async deleteFile(
    hierarchy: HierarchySelect,
    userId: string,
    deviceId: string,
    isPermanent = false,
  ): Promise<HierarchyUpdateResponse[]> {
    const now = new Date()
    const deleteAt = isPermanent ? now : new Date(now.setDate(now.getDate() + 30))
    return this.deleteOrRecoverHierarchy(
      hierarchy,
      userId,
      deviceId,
      deleteAt,
      isPermanent ? FileStatus.TRASHED_PERMANENTLY : FileStatus.TRASHED,
    )
  }

  public async getUserHierarchies(
    userId: string,
    isDeleted: boolean,
    path?: string,
    type = 'vectornator',
  ): Promise<UserHierarchySelect[]> {
    const pathCondition = path !== null && path !== undefined ? { startsWith: path } : undefined
    const deleteCondition = isDeleted ? { not: null } : null
    let condition: Prisma.HierarchyWhereInput = isDeleted
      ? {
          AND: [
            {
              userId,
              path: pathCondition,
              deleteAt: deleteCondition,
              OR: [
                {
                  type: { not: FileType.PRESET },
                },
                {
                  type: null,
                },
              ],
            },
            {
              deleteAt: { gt: new Date() },
            },
          ],
        }
      : {
          userId,
          path: pathCondition,
          deleteAt: deleteCondition,
          OR: [
            {
              type: { not: FileType.PRESET },
            },
            {
              type: null,
            },
          ],
        }

    if (type === 'preset') {
      condition = {
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
      }
    }

    return this.client.hierarchy.findMany({
      where: condition,
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
  }

  public getHierarchyTreeAndFiles(hierarchies: HierarchySelect[]): HierarchyTreeAndFilesResponse {
    const flatHierarchies = hierarchies.map((item) => {
      // Default for folder
      const hierarchyItem: HierarchyTree = {
        id: item.id,
        path: item.path,
        deleteAt: item.deleteAt ?? null,
        files: [],
        children: [],
      }

      if (item.file) {
        hierarchyItem.id = item.id
        hierarchyItem.path = item.path
        hierarchyItem.files = [
          {
            id: item.file.id,
            hierarchyId: item.id,
            name: item.file.name,
            deleteAt: item.deleteAt ?? null,
            path: item.path,
            type: getFileTypeResponse(item.file.type),
            thumbnail: null,
          },
        ]
      }

      return hierarchyItem
    })

    return flatHierarchies.reduce(
      (acc, curr) => {
        const { withoutSlash } = normalizePath(curr.path)
        const lastSlashIdx = withoutSlash.lastIndexOf('/')
        const parentFolder = flatHierarchies.find((h) => h.path === withoutSlash.slice(0, lastSlashIdx + 1))
        // Folder
        if (isEmpty(curr.files)) {
          // Root folder
          if (!parentFolder) {
            acc.hierarchies.push(curr)
          } else {
            parentFolder.children.push(curr)
          }
        } else if (parentFolder) {
          parentFolder.files.push(...curr.files)
        } else {
          acc.files.push(...curr.files)
        }

        return acc
      },
      { hierarchies: [] as HierarchyTree[], files: [] as File[] },
    )
  }

  public async recoverHierarchy(
    hierarchy: HierarchySelect,
    userId: string,
    deviceId: string,
  ): Promise<HierarchyUpdateResponse[]> {
    return this.deleteOrRecoverHierarchy(hierarchy, userId, deviceId, null, FileStatus.CLOSED)
  }

  public async createBatchHierarchy(
    userId: string,
    deviceId: string,
    organizationId: string,
    batchHierarchies: BatchHierarchyItem[],
  ): Promise<void> {
    const fileParams = batchHierarchies
      .filter((hierarchy) => FILE_EXTENSIONS.some((fileExtension) => hierarchy.name.endsWith(fileExtension)))
      .map(
        (hierarchy): Prisma.FileCreateManyInput => ({
          userId,
          deviceId,
          id: uuidV4(),
          name: this.getFilenameFromPath(hierarchy.name),
          size: BigInt(hierarchy.size),
          status: FileStatus.CLOSED,
          type: getFileType(hierarchy.type),
          organizationId,
          checksum: '',
        }),
      )

    await this.client.file.createMany({
      data: fileParams,
      skipDuplicates: true,
    })

    const hierarchyParams = chain(batchHierarchies)
      .map((hierarchy) => this.splitHierarchy(hierarchy.name))
      .flatten()
      .uniq()
      .map((path): Prisma.HierarchyCreateManyInput => {
        const fileId = this.getFileId(path, fileParams)

        return {
          userId,
          deviceId,
          path,
          fileId,
          status: FileStatus.ACTIVE,
          type: this.getFileType(fileId, fileParams),
        }
      })
      .value()

    await this.client.hierarchy.createMany({
      data: hierarchyParams,
      skipDuplicates: true,
    })
  }

  private async deleteOrRecoverHierarchy(
    hierarchy: HierarchySelect,
    userId: string,
    deviceId: string,
    deleteAt: null | Date,
    status: FileStatus,
  ): Promise<HierarchyUpdateResponse[]> {
    // If it's a single file
    if (hierarchy.fileId !== null && hierarchy.fileId !== undefined) {
      await this.client.hierarchy.update({
        where: { id: hierarchy.id },
        data: {
          deleteAt,
          file: {
            update: {
              deleteAt,
              status,
            },
          },
        },
      })
      return [{ id: hierarchy.id, path: hierarchy.path }]
    }

    // First we got what we're going to impact since we'll take it from read instance
    // But the update will be on the write instance
    const hierarchies = await this.client.hierarchy.findMany({
      where: {
        userId,
        deleteAt: deleteAt ? null : { not: null },
        path: {
          startsWith: hierarchy.path,
        },
        user: {
          deleteAt: null,
        },
      },
      select: {
        id: true,
        path: true,
      },
    })

    // Recover all files that folder contain
    await this.client.$transaction([
      this.client.file.updateMany({
        where: {
          userId,
          hierarchy: {
            userId,
            deleteAt: deleteAt ? null : { not: null },
            path: {
              startsWith: hierarchy.path,
            },
            fileId: { not: null },
            user: {
              deleteAt: null,
            },
          },
        },
        data: {
          deleteAt,
          deviceId,
          status,
        },
      }),
      this.client.hierarchy.updateMany({
        where: {
          userId,
          deleteAt: deleteAt ? null : { not: null },
          path: {
            startsWith: hierarchy.path,
          },
          user: {
            deleteAt: null,
          },
        },
        data: {
          deleteAt,
          deviceId,
          status: status === FileStatus.CLOSED ? FileStatus.ACTIVE : status,
        },
      }),
    ])

    return hierarchies
  }

  private async getHierarchy(where: Prisma.HierarchyWhereInput): Promise<HierarchySelect | null> {
    return this.client.hierarchy.findFirst({
      where,
      select: {
        id: true,
        path: true,
        fileId: true,
      },
    })
  }

  private getFileId(path: string, files: Prisma.FileCreateManyInput[]): string | null {
    // eslint-disable-next-line no-restricted-syntax
    for (const file of files) {
      if (path.endsWith(file.name)) {
        return file.id as string
      }
    }

    return null
  }

  private splitHierarchy(pathWithoutSlash: string): string[] {
    const hierarchy = pathWithoutSlash.split('/')
    const paths: string[] = []

    hierarchy.forEach((folder: string) => {
      const lastPath = paths.at(-1)

      let currentPath = folder
      if (lastPath !== undefined) {
        currentPath = `${lastPath}/${folder}`
      }

      paths.push(currentPath)
    })

    return paths.map((path) => {
      const normalizedPath = normalizePath(path)

      if (FILE_EXTENSIONS.some((fileExtension) => path.endsWith(fileExtension))) {
        return normalizedPath.withoutSlash
      }

      return normalizedPath.withSlash
    })
  }

  private getFilenameFromPath(path: string): string {
    const { withoutSlash } = normalizePath(path)
    const idx = withoutSlash.lastIndexOf('/')

    return withoutSlash.slice(idx + 1, withoutSlash.length)
  }

  private getFileType(fileId: string | null, files: Prisma.FileCreateManyInput[]): FileType | null {
    return files.find((file) => file.id === fileId)?.type || null
  }
}
