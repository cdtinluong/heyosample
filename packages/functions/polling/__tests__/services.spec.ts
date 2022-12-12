import { faker } from '@faker-js/faker'
import { FileAction, HierarchyAction, UserAction } from '@layers/prisma'
import { PollingService } from '../services'

const findHierarchyHistorManyMock = jest.fn()
const findFileContentHistoryManyMock = jest.fn()
const findUserHistorySingleMock = jest.fn()
const executeRawMock = jest.fn()

const prismaClient: any = {
  $connect: jest.fn(() => Promise.resolve()),
  hierarchyHistory: {
    findMany: findHierarchyHistorManyMock,
  },
  fileContentHistory: {
    findMany: findFileContentHistoryManyMock,
  },
  userHistory: {
    findFirst: findUserHistorySingleMock,
  },
  $executeRaw: executeRawMock,
}

describe('polling/services.ts', () => {
  describe('getPolling', () => {
    afterEach(() => {
      findHierarchyHistorManyMock.mockClear()
      findFileContentHistoryManyMock.mockClear()
      findUserHistorySingleMock.mockClear()
    })

    it('should return the data without input token', async () => {
      const userId = faker.datatype.uuid()
      const userHistory = {
        id: faker.datatype.uuid(),
        userId: userId,
        action: UserAction.UPDATED,
        deviceId: faker.datatype.uuid(),
        createdAt: new Date('2022-10-20'),
      }

      findUserHistorySingleMock.mockResolvedValue(userHistory)
      // data for 2 files's history => result should be 2 records and the latest status of each file, the file contentId should be set for each file
      const fileIds = Array.from(Array(2).keys()).map(() => faker.datatype.uuid())
      const deviceIds = Array.from(Array(2).keys()).map(() => faker.datatype.uuid())
      const fileContentHistories = [
        {
          id: faker.datatype.uuid(),
          fileContentId: faker.datatype.uuid(),
          fileId: fileIds[0],
          action: FileAction.DELETED,
          deviceId: deviceIds[0],
          createdAt: new Date('2022-10-20'),
        },
        {
          id: faker.datatype.uuid(),
          fileContentId: faker.datatype.uuid(),
          fileId: fileIds[1],
          action: FileAction.UPDATED,
          deviceId: deviceIds[1],
          createdAt: new Date('2022-10-20'),
        },
        {
          id: faker.datatype.uuid(),
          fileContentId: faker.datatype.uuid(),
          fileId: fileIds[0],
          action: FileAction.CREATED,
          deviceId: deviceIds[1], // different device id
          createdAt: new Date('2022-10-19'),
        },
      ]

      // expected result for the file records
      const expectedFileRecords = [
        {
          id: fileContentHistories[0].fileId,
          deviceId: fileContentHistories[0].deviceId,
          action: fileContentHistories[0].action.toLowerCase(),
          item: 'file',
          items: [fileContentHistories[0], fileContentHistories[2]].map((item) => item.fileContentId),
          createdAt: fileContentHistories[0].createdAt,
        },
        {
          id: fileContentHistories[1].fileId,
          deviceId: fileContentHistories[1].deviceId,
          action: fileContentHistories[1].action.toLowerCase(),
          item: 'file',
          items: [fileContentHistories[1].fileContentId],
          createdAt: fileContentHistories[1].createdAt,
        },
      ]
      findFileContentHistoryManyMock.mockResolvedValue(fileContentHistories)

      const hierarchyIds = Array.from(Array(2).keys()).map(() => faker.datatype.uuid())
      const hierarchyHistories = [
        {
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[0],
          action: HierarchyAction.UPDATED,
          deviceId: deviceIds[0],
          createdAt: new Date('2022-10-20'),
        },
        {
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[0],
          action: HierarchyAction.CREATED,
          deviceId: deviceIds[1],
          createdAt: new Date('2022-10-10 20:01:00'),
        },
        {
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[1], // different id
          action: HierarchyAction.UPDATED,
          deviceId: deviceIds[1],
          createdAt: new Date('2022-10-10 20:00:00'),
        },
        // insert to test the next token
        ...Array.from(Array(97).keys()).map((val) => ({
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[1], // different id
          action: HierarchyAction.UPDATED,
          deviceId: deviceIds[1],
          createdAt: new Date(new Date('2022-10-09 20:00:00').getTime() - val), // descrease date
        })),
      ]
      // expected result for hierarchy records
      const expectedHierarchyRecords = [
        {
          id: hierarchyHistories[0].hierarchyId,
          deviceId: deviceIds[0],
          action: HierarchyAction.UPDATED.toLowerCase(),
          item: 'hierarchy',
          createdAt: hierarchyHistories[0].createdAt,
          items: undefined,
        },
        {
          id: hierarchyHistories[2].hierarchyId,
          deviceId: deviceIds[1],
          action: HierarchyAction.UPDATED.toLowerCase(),
          item: 'hierarchy',
          createdAt: hierarchyHistories[2].createdAt,
          items: undefined,
        },
      ]
      findHierarchyHistorManyMock.mockResolvedValue(hierarchyHistories)

      const service = new PollingService(prismaClient)
      const latestTime = new Date()
      const nextToken = Buffer.from(
        JSON.stringify({
          hierarchy: {
            id: hierarchyHistories[hierarchyHistories.length - 1].id,
            createdAt: hierarchyHistories[hierarchyHistories.length - 1].createdAt, // smallest date
          },
        }),
      ).toString('base64')
      const result = await service.getPolling(userId, latestTime)
      const expected = {
        items: [
          ...expectedHierarchyRecords,
          ...expectedFileRecords,
          {
            id: userHistory.userId,
            deviceId: userHistory.deviceId,
            action: userHistory.action.toLowerCase(),
            item: 'user',
            createdAt: userHistory.createdAt,
            items: undefined,
          },
        ],
        next: nextToken,
      }

      expect(result).toEqual(expected)
      expect(findUserHistorySingleMock).toHaveBeenCalledWith({
        where: {
          userId,
          action: {
            // only get by those info
            in: [UserAction.CREATED, UserAction.DELETED, UserAction.UPDATED],
          },
          createdAt: {
            gte: new Date(latestTime),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: { id: true, userId: true, action: true, deviceId: true, createdAt: true },
      })
      expect(findFileContentHistoryManyMock).toHaveBeenCalledWith({
        where: {
          file: {
            userId,
          },
          action: {
            // only get by those info
            in: [FileAction.CREATED, FileAction.UPDATED, FileAction.RECOVERED, FileAction.DELETED],
          },
          createdAt: {
            gte: new Date(latestTime),
          },
        },
        orderBy: [
          {
            createdAt: 'desc',
          },
          { id: 'asc' },
        ],
        select: { id: true, fileContentId: true, action: true, deviceId: true, createdAt: true, fileId: true },
        take: 100,
      })
      expect(findHierarchyHistorManyMock).toHaveBeenCalledWith({
        where: {
          hierarchy: {
            userId,
          },
          createdAt: {
            gte: new Date(latestTime),
          },
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
        take: 100,
      })
    })

    it('should return the data with input token', async () => {
      const userId = faker.datatype.uuid()
      // data for 2 files's history => result should be 2 records and the latest status of each file, the file contentId should be set for each file
      const fileIds = Array.from(Array(2).keys()).map(() => faker.datatype.uuid())
      const deviceIds = Array.from(Array(2).keys()).map(() => faker.datatype.uuid())
      const fileContentHistories = [
        {
          id: faker.datatype.uuid(),
          fileContentId: faker.datatype.uuid(),
          fileId: fileIds[0],
          action: FileAction.DELETED,
          deviceId: deviceIds[0],
          createdAt: new Date('2022-10-20'),
        },
        {
          id: faker.datatype.uuid(),
          fileContentId: faker.datatype.uuid(),
          fileId: fileIds[1],
          action: FileAction.UPDATED,
          deviceId: deviceIds[1],
          createdAt: new Date('2022-10-20'),
        },
        {
          id: faker.datatype.uuid(),
          fileContentId: faker.datatype.uuid(),
          fileId: fileIds[0],
          action: FileAction.CREATED,
          deviceId: deviceIds[1], // different device id
          createdAt: new Date('2022-10-19'),
        },
      ]

      // expected result for the file records
      const expectedFileRecords = [
        {
          id: fileContentHistories[0].fileId,
          deviceId: fileContentHistories[0].deviceId,
          action: fileContentHistories[0].action.toLowerCase(),
          item: 'file',
          items: [fileContentHistories[0], fileContentHistories[2]].map((item) => item.fileContentId),
          createdAt: fileContentHistories[0].createdAt,
        },
        {
          id: fileContentHistories[1].fileId,
          deviceId: fileContentHistories[1].deviceId,
          action: fileContentHistories[1].action.toLowerCase(),
          item: 'file',
          items: [fileContentHistories[1].fileContentId],
          createdAt: fileContentHistories[1].createdAt,
        },
      ]
      findFileContentHistoryManyMock.mockResolvedValue(fileContentHistories)

      const hierarchyIds = Array.from(Array(2).keys()).map(() => faker.datatype.uuid())
      const hierarchyHistories = [
        {
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[0],
          action: HierarchyAction.UPDATED,
          deviceId: deviceIds[0],
          createdAt: new Date('2022-10-20'),
        },
        {
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[0],
          action: HierarchyAction.CREATED,
          deviceId: deviceIds[1],
          createdAt: new Date('2022-10-10 20:01:00'),
        },
        {
          id: faker.datatype.uuid(),
          hierarchyId: hierarchyIds[1], // different id
          action: HierarchyAction.CREATED,
          deviceId: deviceIds[1],
          createdAt: new Date('2022-10-10 20:00:00'),
        },
      ]
      // expected result for hierarchy records
      const expectedHierarchyRecords = [
        {
          id: hierarchyHistories[0].hierarchyId,
          deviceId: deviceIds[0],
          action: HierarchyAction.UPDATED.toLowerCase(),
          item: 'hierarchy',
          createdAt: hierarchyHistories[0].createdAt,
          items: undefined,
        },
        {
          id: hierarchyHistories[2].hierarchyId,
          deviceId: deviceIds[1],
          action: HierarchyAction.CREATED.toLowerCase(),
          item: 'hierarchy',
          createdAt: hierarchyHistories[2].createdAt,
          items: undefined,
        },
      ]
      findHierarchyHistorManyMock.mockResolvedValue(hierarchyHistories)

      const service = new PollingService(prismaClient)
      const latestTime = new Date('2020-01-01')
      const previousToken = Buffer.from(
        JSON.stringify({
          hierarchy: {
            id: 'hierarchy_history_id',
            createdAt: hierarchyHistories[2].createdAt,
          },
          file: {
            id: 'file_history_id',
            createdAt: fileContentHistories[2].createdAt,
          },
        }),
      ).toString('base64')
      const result = await service.getPolling(userId, latestTime, previousToken)
      const expected = {
        items: [...expectedHierarchyRecords, ...expectedFileRecords],
        next: undefined,
      }

      expect(result).toEqual(expected)
      expect(findUserHistorySingleMock).not.toHaveBeenCalled() // not call on nex token
      expect(findFileContentHistoryManyMock).toHaveBeenCalledWith({
        where: {
          file: {
            userId,
          },
          action: {
            // only get by those info
            in: [FileAction.CREATED, FileAction.UPDATED, FileAction.RECOVERED, FileAction.DELETED],
          },
          NOT: {
            id: 'file_history_id',
          },
          AND: [
            {
              createdAt: {
                lte: fileContentHistories[2].createdAt,
              },
            },
            {
              createdAt: {
                gte: new Date(latestTime),
              },
            },
          ],
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
        take: 100,
      })
      expect(findHierarchyHistorManyMock).toHaveBeenCalledWith({
        where: {
          hierarchy: {
            userId,
          },
          NOT: {
            id: 'hierarchy_history_id',
          },
          AND: [
            {
              createdAt: {
                lte: hierarchyHistories[2].createdAt,
              },
            },
            {
              createdAt: {
                gte: new Date(latestTime),
              },
            },
          ],
        },
        orderBy: [
          {
            createdAt: 'desc',
          },
          { id: 'asc' },
        ],
        select: { id: true, action: true, deviceId: true, createdAt: true, hierarchyId: true },
        take: 100,
      })
    })
  })
})
