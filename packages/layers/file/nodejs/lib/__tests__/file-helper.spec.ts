import { FileHelper, MAX_CHUNK_SIZE, MAX_FILE_SIZE, MIN_CHUNK_SIZE } from '../file-helper'

const mS3ClientInstance = {
  send: jest.fn(),
}

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn(() => mS3ClientInstance),
    CreateMultipartUploadCommand: jest.fn(),
    UploadPartCommand: jest.fn(),
    CompleteMultipartUploadCommand: jest.fn(),
    AbortMultipartUploadCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectsCommand: jest.fn(),
  }
})

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  ...jest.requireActual('@aws-sdk/s3-request-presigner'),
  getSignedUrl: jest.fn().mockResolvedValue('https://presignedUrl'),
}))

const bucketName = 'bucketName'
const uploadId = 'uploadId'
const key = '1/2/3.zip'
const version = '1'

describe('FileHelper', () => {
  afterEach(() => {
    mS3ClientInstance.send.mockReset()
  })

  describe('uploadMultipart', () => {
    it('should create multipart upload successfully - file size 5 MiB', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()
      const res = await fileHelper.uploadMultipart(bucketName, key, MIN_CHUNK_SIZE)

      expect(res).toEqual({
        uploadId,
        presignedUrls: ['https://presignedUrl'],
        chunkSize: MIN_CHUNK_SIZE,
      })
    })

    it('should create multipart upload successfully - file size 10 MiB', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()
      const res = await fileHelper.uploadMultipart(bucketName, key, MIN_CHUNK_SIZE * 2)

      expect(res).toEqual({
        uploadId,
        presignedUrls: ['https://presignedUrl'],
        chunkSize: MIN_CHUNK_SIZE * 2,
      })
    })

    it('should create multipart upload successfully - file size is 5 GiB', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()
      const res = await fileHelper.uploadMultipart(bucketName, key, MAX_CHUNK_SIZE)

      expect(res.presignedUrls.length).toBe(1)
    })

    it('should create multipart upload successfully - file size is 50 GiB', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()
      const res = await fileHelper.uploadMultipart(bucketName, key, 53687091200)

      expect(res.presignedUrls.length).toEqual(10)
    })

    it('should create multipart upload successfully - file size is 2 TiB', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()
      const res = await fileHelper.uploadMultipart(bucketName, key, 2199023255552)

      expect(res.presignedUrls.length).toEqual(410)
    })

    it('should create multipart upload successfully - file size is 3 TiB', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()
      const res = await fileHelper.uploadMultipart(bucketName, key, 3298534883328)

      expect(res.presignedUrls.length).toEqual(615)
    })

    it('should create multipart upload failed - cannot get chunk size', async () => {
      mS3ClientInstance.send.mockResolvedValue({ UploadId: uploadId })

      const fileHelper = new FileHelper()

      return fileHelper.uploadMultipart(bucketName, key, MAX_FILE_SIZE).catch((err) => {
        expect(err).toBeDefined()
      })
    })
  })

  describe('completeMultipartUpload', () => {
    it('should complete multipart upload successfully', async () => {
      mS3ClientInstance.send.mockResolvedValue({ Key: key, VersionId: version })

      const fileHelper = new FileHelper()
      const res = await fileHelper.completeMultipartUpload(bucketName, uploadId, key, [])

      expect(res).toEqual({ Key: key, VersionId: version })
    })
  })

  describe('abortMultipartUpload', () => {
    it('should abort multipart upload successfully', async () => {
      mS3ClientInstance.send.mockResolvedValue({ RequestCharged: '1' })

      const fileHelper = new FileHelper()
      const res = await fileHelper.abortMultipartUpload(bucketName, uploadId, key)

      expect(res).toEqual({ RequestCharged: '1' })
    })
  })

  describe('downloadMultipart', () => {
    it('should download multipart successfully - file size is 5 MiB', async () => {
      const fileHelper = new FileHelper()
      const res = await fileHelper.downloadMultipart(bucketName, key, MIN_CHUNK_SIZE)

      expect(res).toEqual({
        presignedUrls: ['https://presignedUrl'],
        chunkSize: MIN_CHUNK_SIZE,
      })
    })

    it('should download multipart successfully - file size is 5 GiB', async () => {
      const fileHelper = new FileHelper()
      const res = await fileHelper.downloadMultipart(bucketName, key, MAX_CHUNK_SIZE)

      expect(res).toEqual({
        presignedUrls: ['https://presignedUrl'],
        chunkSize: MAX_CHUNK_SIZE,
      })
    })
  })

  describe('deleteObjects', () => {
    it('should delete objects successfully', async () => {
      mS3ClientInstance.send.mockResolvedValue({ Deleted: [{ Key: key, VersionId: version }] })

      const fileHelper = new FileHelper()
      const res = await fileHelper.deleteObjects(bucketName, [{ key, version }])

      expect(res).toEqual({ Deleted: [{ Key: key, VersionId: version }] })
    })
  })
})
