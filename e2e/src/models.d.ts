interface CreateHierarchy {
  id: string
  path: string
  fileId?: string
}

interface CreateHierarchyResponse {
  data: CreateHierarchy
  message: string
  code: string
}

interface HierarchyResponse {
  id: string
  path: string
  deleteAt?: Date
  files: File[]
  children: HierarchyResponse[]
}

interface File {
  id: string
  hierarchyId: string
  name: string
  deleteAt: Date
  path: string
}
