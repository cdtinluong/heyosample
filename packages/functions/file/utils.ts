import { FileType } from '@layers/prisma'

export function normalizePath(path: string) {
  const isEndingWithSlash = path.endsWith('/')

  return {
    withSlash: isEndingWithSlash ? path : path.concat('/'),
    withoutSlash: isEndingWithSlash ? path.slice(0, -1) : path,
  }
}

export function getFileType(type: string): FileType | null {
  switch (type) {
    case 'vectornator':
      return FileType.VECTORNATOR
    case 'animator':
      return FileType.ANIMATOR
    case 'preset':
      return FileType.PRESET
    default:
      return null
  }
}

export function getFileTypeResponse(type: FileType | null): string | null {
  switch (type) {
    case FileType.VECTORNATOR:
      return 'vectornator'
    case FileType.ANIMATOR:
      return 'animator'
    case FileType.PRESET:
      return 'preset'
    default:
      return null
  }
}
