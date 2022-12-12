import { FileService } from 'file/services'
import { HierarchyTree } from './models'

export async function associateFileThumbnail(fileService: FileService, userId: string, hierarchies: HierarchyTree[]) {
  const filesThumbnails = await fileService.getFilesThumbnail(
    userId,
    hierarchies.flatMap((hierarchy) => hierarchy.files.map((file) => file.id)),
  )
  hierarchies.forEach((hierarchy) => {
    hierarchy.files.forEach((file) => {
      // this can be assigned
      // eslint-disable-next-line no-param-reassign
      file.thumbnail = filesThumbnails.get(file.id) ?? null
    })
  })
}

export function validateFileSize(fileSize: string): boolean {
  return BigInt(fileSize) < BigInt('1') || BigInt(fileSize) > BigInt('9223372036854775807')
}
