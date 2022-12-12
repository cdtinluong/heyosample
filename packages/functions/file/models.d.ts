import { FileStatus, Hierarchy, FileType } from '@layers/prisma'

export interface FileContentUpload {
  name: string
  size: number
}

export interface FileContentUploadComplete {
  uploadId: string
  name: string
  version: string
  parts: Part[]
}

export interface FileContentUploadAbort {
  uploadId: string
  name: string
}

export interface Part {
  ETag: string
  PartNumber: number
}

export interface FileCreationResponse {
  hierarchy: Hierarchy | null
}

export interface FileDownloadRequest {
  name: string
  version: string
}

export interface FileDownloadResponse {
  name: string
  version: string
  chunkSize: number
  presignedUrls: string[]
}

export interface FileSelect {
  id: string
  name: string
  checksum: string
  size: bigint
  status: FileStatus
  type: FileType | null
  hasConflict: boolean
  deleteAt: Date | null
}

export interface FileSelectWithContents extends FileSelect {
  contents: FileContentSelect[]
}

export interface FileUploadResponse {
  name: string
  conflictedVersion?: string
  uploadId?: string
  chunkSize: number
  presignedUrls: string[]
}

export interface FileContentHistorySelect {
  file_content_id: string
  name: string
  version: string
  size: bigint
}

export interface FileContentSelect {
  id: string
  name: string
  size: bigint
  status: FileStatus
  version: string
}

export interface CompletedUploading {
  name: string
  version: string
}

export interface CompleteUploadResult {
  successes: CompletedUploading[]
  failures: string[]
}

export interface ConflictResolutionRequest {
  name: string
  keepingVersion: string
  deletingVersion: string
}

export interface ConflictFileResponse {
  id: string
  name: string
  versions: string[]
}
