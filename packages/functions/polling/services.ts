import { UserAction, FileAction, HierarchyAction } from '@layers/prisma'
import { PrismaService } from '@layers/prisma/prisma.svc'
import { groupBy } from 'lodash'
import { isIsoDate } from './utils'

export enum HistoryType {
  file = 'file',
  user = 'user',
  hierarchy = 'hierarchy',
}

interface PollingRecord {
  id: string
  action: string
  deviceId: string
  item: HistoryType
  items?: string[]
  createdAt: Date
}

/**
 * transform the db data into history data
 *
 * @param item db item
 * @param historyType history record type
 */
function transformHistoryItem(
  item: {
    id: string
    action: UserAction | FileAction | HierarchyAction
    deviceId: string
    items?: string[]
    createdAt: Date
  },
  historyType: HistoryType,
): PollingRecord {
  // @TODO: confirm about action not in (created, deleted, updated) Eg: recovered. Need to add to api docs as well
  const action = item.action.toLowerCase()
  return {
    id: item.id,
    deviceId: item.deviceId,
    action,
    item: historyType,
    items: item.items,
    createdAt: item.createdAt,
  }
}

export class PollingService extends PrismaService {
  /**
   * get the update since lastUpdate
   *
   * @param userId user Id to query
   * @param lastUpdate the last update time from client
   */
  public async getPolling(userId: string, lastUpdateTime: Date, nextToken?: string) {
    const maxRecordLimit = 100 // record limit for each type
    const paginationInfo = this.getPagination(nextToken)
    const fileToken = paginationInfo.file
    const hierarchyToken = paginationInfo.hierarchy

    const userUpdateRecordsPromise =
      nextToken == null
        ? this.client.userHistory.findFirst({
            where: {
              userId,
              action: {
                // only get by those info
                in: [UserAction.CREATED, UserAction.DELETED, UserAction.UPDATED],
              },
              createdAt: {
                gte: lastUpdateTime,
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: { id: true, userId: true, action: true, deviceId: true, createdAt: true },
          })
        : Promise.resolve(null) // if has next token => don't need to get the user record

    const fileUpdateRecordsPromise = this.client.fileContentHistory.findMany({
      where: {
        file: {
          userId,
        },
        action: {
          // only get by those info
          in: [FileAction.CREATED, FileAction.UPDATED, FileAction.RECOVERED, FileAction.DELETED],
        },
        ...(fileToken != null
          ? {
              NOT: { id: fileToken.id },
              AND: [
                {
                  createdAt: {
                    lte: fileToken.createdAt,
                  },
                },
                {
                  createdAt: {
                    gte: lastUpdateTime,
                  },
                },
              ],
            }
          : {
              createdAt: {
                gte: lastUpdateTime,
              },
            }),
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'asc',
        },
      ],
      select: { id: true, fileContentId: true, action: true, deviceId: true, createdAt: true, fileId: true },
      take: maxRecordLimit,
    })

    // Note: We can do this better by group by and join to get only the latest data from database
    const hierarchyUpdateRecordsPromise = this.client.hierarchyHistory.findMany({
      where: {
        hierarchy: {
          userId,
        },
        ...(hierarchyToken != null
          ? {
              NOT: { id: hierarchyToken.id },
              AND: [
                {
                  createdAt: {
                    lte: hierarchyToken.createdAt,
                  },
                },
                {
                  createdAt: {
                    gte: lastUpdateTime,
                  },
                },
              ],
            }
          : {
              createdAt: {
                gte: lastUpdateTime,
              },
            }),
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'asc',
        },
      ],
      select: { id: true, action: true, deviceId: true, createdAt: true, hierarchyId: true },
      take: maxRecordLimit,
    })

    const [userRecord, fileRecords, hierarchyRecords] = await Promise.all([
      userUpdateRecordsPromise,
      fileUpdateRecordsPromise,
      hierarchyUpdateRecordsPromise,
    ])

    const nextPageToken: ReturnType<typeof this.getPagination> = {}
    const updatedRecords: PollingRecord[] = []
    // group hierarchy records
    const hierarchyRecordsGroup = groupBy(hierarchyRecords, (record) => record.hierarchyId)

    // may have next data
    if (hierarchyRecords.length === maxRecordLimit) {
      // insert the latest one
      nextPageToken.hierarchy = {
        id: hierarchyRecords[hierarchyRecords.length - 1].id,
        createdAt: hierarchyRecords[hierarchyRecords.length - 1].createdAt,
      }
    }

    Object.values(hierarchyRecordsGroup).forEach((records) => {
      // sort desc
      records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      // get only the first record (the same hierarchy)
      updatedRecords.push(transformHistoryItem({ ...records[0], id: records[0].hierarchyId }, HistoryType.hierarchy))
    })

    // may have next data
    if (fileRecords.length === maxRecordLimit) {
      // insert the latest one
      nextPageToken.file = {
        id: fileRecords[fileRecords.length - 1].id,
        createdAt: fileRecords[fileRecords.length - 1].createdAt,
      }
    }

    // file history (Group by fileId)
    const filesRecordsGroup = groupBy(fileRecords, (record) => record.fileId)
    Object.values(filesRecordsGroup).forEach((records) => {
      // sort desc
      records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      // get only the first record (mean the latest status of file)
      updatedRecords.push(
        // for file record => we will need to send list of files
        transformHistoryItem(
          {
            ...{ ...records[0], id: records[0].fileId },
            // get file content id
            items: [...new Set<string>(records.map((file) => file.fileContentId))],
          },
          HistoryType.file,
        ),
      )
    })

    if (userRecord != null)
      updatedRecords.push(transformHistoryItem({ ...userRecord, id: userRecord.userId }, HistoryType.user))

    return { items: updatedRecords, next: this.createPagination(nextPageToken) }
  }

  /**
   * create next token
   *
   * @param nextToken source data for next token
   * @returns encoded base64 string for the next token if the nextToken has value, undefined otherwise
   */
  private createPagination(nextToken: Record<string, any>): string | undefined {
    if (Object.keys(nextToken).length === 0) return undefined

    return Buffer.from(JSON.stringify(nextToken)).toString('base64')
  }

  /**
   * decode base64 nextToken into object
   *
   * @param nextToken base64 string for next token
   * @returns object contain the data of the token
   */
  private getPagination(nextToken?: string): Record<string, { id: string; createdAt: Date }> {
    if (nextToken == null) return {}
    // decode the token
    const decodedToken = Buffer.from(nextToken, 'base64').toString('utf-8')
    const parsedTokens = JSON.parse(decodedToken) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsedTokens).map(([key, value]) => {
        if (value == null) throw new Error(`Invalid pagination token: ${key} have invalid value, token: ${nextToken}`)

        if (typeof value !== 'object')
          throw new Error(`Invalid pagination token: ${key} have invalid value, token: ${nextToken}`)
        const record = value as Record<string, unknown>

        // value pattern should be { id, createdAt }
        if (
          !('id' in record) ||
          !('createdAt' in record) ||
          typeof record.id !== 'string' ||
          typeof record.createdAt !== 'string'
        )
          throw new Error(`Invalid pagination token: ${key} have invalid value, token: ${nextToken}`)

        const tokenKey = record as { id: string; createdAt: string }

        // validate the date format
        if (!isIsoDate(tokenKey.createdAt))
          throw new Error(`Invalid pagination token: ${key} have invalid value (Invalid date), token: ${nextToken}`)

        return [key, { id: tokenKey.id, createdAt: new Date(tokenKey.createdAt) }]
      }),
    )
  }
}
