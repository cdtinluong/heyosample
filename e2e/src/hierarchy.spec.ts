import { faker } from '@faker-js/faker'
import { getCognitoToken, postFn, deleteFn, patchFn, getFn } from './utils'

const API_ENDPOINT = `${process.env.API_ENDPOINT ?? 'https://dev.cloud.linearity.io'}/hierarchy`
jest.setTimeout(60000)
describe('Hierarchy Flow', () => {
  describe('Successful Flow', () => {
    let accessToken = ''
    beforeAll(async () => {
      const token = await getCognitoToken()
      accessToken = token.AuthenticationResult.IdToken
    })
    let hierarchyRootId = ''
    let hierarchySubId = ''
    let fileNameAtRoot = ''
    let fileNameAtSub = ''
    let rootFolderPath = '/root-test2/'
    let subFolderPath = '/root-test2/sub/'
    let hierarchyFileRootId = ''

    it('Create an root folder successfully', async () => {
      const data = {
        folder: rootFolderPath,
      }
      const result = await postFn(API_ENDPOINT, accessToken, data)
      const body = result.body as CreateHierarchyResponse
      expect(result.status).toEqual(201)
      expect(body.data.id).toBeDefined()
      hierarchyRootId = body.data.id
    })

    it('Create an sub folder successfully', async () => {
      const data = {
        folder: subFolderPath,
      }
      const result = await postFn(API_ENDPOINT, accessToken, data)
      const body = result.body as CreateHierarchyResponse
      expect(result.status).toEqual(201)
      expect(body.data.id).toBeDefined()
      hierarchySubId = body.data.id
    })

    it('Create a file at the sub folder', async () => {
      const data = {
        folder: subFolderPath,
        file: {
          name: faker.system.commonFileName('vectornator'),
          size: 100,
        },
      }
      fileNameAtSub = data.file.name
      const result = await postFn(API_ENDPOINT, accessToken, data)
      const body = result.body as CreateHierarchyResponse
      expect(result.status).toEqual(201)
      expect(body.data.id).toBeDefined()
    })

    it('Create a file at the root', async () => {
      const data = {
        folder: rootFolderPath,
        file: {
          name: faker.system.commonFileName('vectornator'),
          size: 100,
        },
      }
      fileNameAtRoot = data.file.name
      const result = await postFn(API_ENDPOINT, accessToken, data)
      const body = result.body as CreateHierarchyResponse
      expect(result.status).toEqual(201)
      expect(body.data.id).toBeDefined()
      hierarchyFileRootId = body.data.id
    })

    it('Get list hierarchy owner', async () => {
      const resultGet = await getFn(`${API_ENDPOINT}/list/owner`, accessToken)
      expect(resultGet.status).toEqual(200)
      expect(resultGet.body.data.length).toBeGreaterThan(0)
      const findRootFolder = resultGet.body.data[0].children.find((x: HierarchyResponse) => x.id === hierarchyRootId)
      expect(findRootFolder).toBeDefined()
      expect(findRootFolder.files.length).toBeGreaterThan(0)
      expect(findRootFolder.children.length).toBeGreaterThan(0)

      const subFolder = findRootFolder.children[0]
      expect(subFolder.files.length).toBeGreaterThan(0)
    })

    it('Rename the sub folder', async () => {
      const dataUpdate = {
        oldPath: subFolderPath,
        newPath: `/root-test2/sub-rename/`,
      }
      const resultUpdate = await patchFn(API_ENDPOINT, accessToken, dataUpdate)
      expect(resultUpdate.status).toEqual(200)
      subFolderPath = dataUpdate.newPath
    })

    it('Rename the file', async () => {
      const newFileName = faker.system.commonFileName('vectornator')
      const dataUpdate = {
        oldPath: `${subFolderPath}${fileNameAtSub}`,
        newPath: `${subFolderPath}${newFileName}`,
      }
      const resultUpdate = await patchFn(API_ENDPOINT, accessToken, dataUpdate)
      expect(resultUpdate.status).toEqual(200)
      fileNameAtSub = newFileName
    })

    it('Check folder and file rename successfully', async () => {
      const resultGet = await getFn(`${API_ENDPOINT}/list/owner`, accessToken)
      expect(resultGet.status).toEqual(200)
      expect(resultGet.body.data.length).toBeGreaterThan(0)
      const findRootFolder = resultGet.body.data[0].children.find((x: HierarchyResponse) => x.id === hierarchyRootId)
      expect(findRootFolder).toBeDefined()
      expect(findRootFolder.files.length).toBeGreaterThan(0)
      expect(findRootFolder.children.length).toBeGreaterThan(0)

      const subFolder = findRootFolder.children[0]
      expect(subFolder.files.length).toBeGreaterThan(0)
      expect(subFolder.path).toContain('sub-rename')
      expect(subFolder.files[0].name).toEqual(fileNameAtSub)
    })

    it('Delete sub folder successfully', async () => {
      const result = await deleteFn(`${API_ENDPOINT}/${hierarchySubId}`, accessToken)
      expect(result.status).toEqual(200)
    })

    it('Get list hierarchy trashed check if folder', async () => {
      const resultGet = await getFn(`${API_ENDPOINT}/list/trashed`, accessToken)
      expect(resultGet.status).toEqual(200)
      expect(resultGet.body.data.hierarchies.length).toBeGreaterThan(0)
      let findSubFolderDelete = undefined
      const rootFolders = resultGet.body.data.hierarchies.filter((x: HierarchyResponse) => x.children.length > 0)
      rootFolders.forEach((item: HierarchyResponse) => {
        findSubFolderDelete = item.children.find((x: HierarchyResponse) => x.id === hierarchySubId)
      })
      expect(findSubFolderDelete).toBeDefined()
    })

    it('Delete file permanent', async () => {
      const result = await deleteFn(`${API_ENDPOINT}/${hierarchyFileRootId}`, accessToken)
      expect(result.status).toEqual(200)
      const resultPermanent = await deleteFn(`${API_ENDPOINT}/${hierarchyFileRootId}/permanent`, accessToken)
      expect(resultPermanent.status).toEqual(200)
      const resultTrash = await getFn(`${API_ENDPOINT}/list/trashed`, accessToken)
      expect(resultTrash.status).toEqual(200)
      const rootFolders = resultTrash.body.data.hierarchies.filter(
        (x: HierarchyResponse) => x.path === rootFolderPath && x.files.length > 0,
      )
      let findFileDeletePermanent = undefined
      rootFolders.forEach((item: HierarchyResponse) => {
        findFileDeletePermanent = item.files.find((x: File) => x.name === fileNameAtRoot)
      })
      expect(findFileDeletePermanent).toBeUndefined()

      const resultGet = await getFn(`${API_ENDPOINT}/list/owner`, accessToken)
      expect(resultGet.status).toEqual(200)
      expect(resultGet.body.data.length).toBeGreaterThan(0)
      const findRootFolder = resultGet.body.data[0].children.find((x: HierarchyResponse) => x.id === hierarchyRootId)
      expect(findRootFolder).toBeDefined()
      expect(findRootFolder.files.length).toEqual(0)
    })

    it('Delete root folder successfully', async () => {
      const result = await deleteFn(`${API_ENDPOINT}/${hierarchyRootId}`, accessToken)
      expect(result.status).toEqual(200)
    })
  })
})
