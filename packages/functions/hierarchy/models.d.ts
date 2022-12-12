import { FileType } from '@layers/prisma'

export interface HierarchyTree {
  id: string
  path: string
  files: File[]
  children: HierarchyTree[]
  deleteAt: Date | null
}

export interface File {
  id: string
  hierarchyId: string
  name: string
  deleteAt: Date | null
  path: string | null
  type: string | null
  thumbnail: string | null
}

export interface FileSelect {
  id: string
  name: string
  type: FileType | null
}

export interface HierarchySelect {
  id: string
  path: string
  fileId?: string | null
  deleteAt?: Date | null
  file?: FileSelect | null
}

export interface BatchHierarchyItem {
  name: string
  size: string
  type: string
}

export interface HierarchyCreationResponse {
  id: string
  path: string
  fileId: string | null
}

export interface FileRenameResponse {
  id: string
}

export interface HierarchyUpdateResponse {
  id: string
  path: string
}

export interface UserHierarchySelect {
  id: string
  path: string
  deleteAt: Date | null
  file: FileSelect | null
}

export interface HierarchyTreeAndFilesResponse {
  hierarchies: HierarchyTree[]
  files: File[]
}
