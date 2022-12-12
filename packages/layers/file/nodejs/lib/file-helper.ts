import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  GetObjectCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  AbortMultipartUploadCommandOutput,
  DeleteObjectsCommand,
  CompleteMultipartUploadCommandOutput,
  DeleteObjectsCommandOutput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { orderBy } from 'lodash'

export const MAX_FILE_SIZE = 5497558138880 // 5 TiB
export const MIN_CHUNK_SIZE = 5242880 // 5 MiB
export const MAX_CHUNK_SIZE = 5368709120 // 5 GiB
const EXPIRY_TIME = 24 * 60 * 60 // 24 hours
const MAX_NUMBER_OF_PARTS = 1000

interface Part {
  ETag: string
  PartNumber: number
}

interface DeletingObjectParam {
  key: string
  version?: string
}

interface DownloadMultipartResponse {
  presignedUrls: string[]
  chunkSize: number
}

interface UploadMultipartResponse {
  uploadId: string
  chunkSize: number
  presignedUrls: string[]
}

interface ChunkSizeResult {
  numberOfParts: number
  chunkSize: number
}

export class FileHelper {
  private s3Client: S3Client

  public constructor() {
    this.s3Client = new S3Client({
      region: 'us-west-2',
    })
  }

  public async uploadMultipart(bucketName: string, key: string, size: number): Promise<UploadMultipartResponse> {
    const now = new Date()
    const expiryTime = new Date(now.setDate(now.getDate() + 1))

    const res = await this.s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        Expires: expiryTime,
      }),
    )
    const promises = []
    const { numberOfParts, chunkSize } = this.getChunkSize(size)

    for (let index = 0; index < numberOfParts; index += 1) {
      promises.push(
        getSignedUrl(
          this.s3Client,
          new UploadPartCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: res.UploadId,
            PartNumber: index + 1,
          }),
          { expiresIn: EXPIRY_TIME },
        ),
      )
    }

    const presignedUrls = await Promise.all(promises)

    return {
      uploadId: res.UploadId as string,
      chunkSize,
      presignedUrls,
    }
  }

  public async completeMultipartUpload(
    bucketName: string,
    uploadId: string,
    key: string,
    parts: Part[],
  ): Promise<CompleteMultipartUploadCommandOutput> {
    return this.s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        MultipartUpload: { Parts: orderBy(parts, ['PartNumber'], ['asc']) },
        UploadId: uploadId,
      }),
    )
  }

  public async abortMultipartUpload(
    bucketName: string,
    uploadId: string,
    key: string,
  ): Promise<AbortMultipartUploadCommandOutput> {
    return this.s3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
      }),
    )
  }

  public async downloadMultipart(
    bucketName: string,
    key: string,
    size: number,
    version?: string,
  ): Promise<DownloadMultipartResponse> {
    const { numberOfParts, chunkSize } = this.getChunkSize(size)

    const promises = []
    for (let index = 0; index < numberOfParts; index += 1) {
      promises.push(
        getSignedUrl(
          this.s3Client,
          new GetObjectCommand({
            Key: key,
            Bucket: bucketName,
            PartNumber: index + 1,
            VersionId: version,
          }),
          { expiresIn: EXPIRY_TIME },
        ),
      )
    }

    const presignedUrls = await Promise.all(promises)

    return {
      chunkSize,
      presignedUrls,
    }
  }

  /**
   * download file from s3 using presigned url
   *
   * @param bucketName s3 bucket name
   * @param key s3 key
   * @param version file version id
   * @returns presigned url to download the file (Note, file will be expired after 24h)
   */
  public async downloadFile(bucketName: string, key: string, version?: string): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Key: key,
        Bucket: bucketName,
        VersionId: version,
      }),
      { expiresIn: EXPIRY_TIME },
    )
  }

  public async deleteObjects(
    bucketName: string,
    deletingParams: DeletingObjectParam[],
  ): Promise<DeleteObjectsCommandOutput> {
    return this.s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: deletingParams.map((param) => ({ Key: param.key, VersionId: param.version })),
        },
      }),
    )
  }

  private getChunkSize(fileSize: number): ChunkSizeResult {
    for (let i = 1; i <= MAX_NUMBER_OF_PARTS; i += 1) {
      const chunkSize = Math.ceil(fileSize / i)

      if (chunkSize <= MAX_CHUNK_SIZE) {
        return {
          numberOfParts: i,
          chunkSize,
        }
      }
    }

    throw new Error(`Cannot get chunk size for file size ${fileSize}`)
  }
}
