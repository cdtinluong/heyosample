import { normalizePath } from '../utils'

describe('file/utils', () => {
  describe('normalizePath', () => {
    it('should normalize path ending with slash correctly', () => {
      const result = normalizePath('abc/xyz/')

      expect(result.withSlash).toEqual('abc/xyz/')
      expect(result.withoutSlash).toEqual('abc/xyz')
    })

    it('should normalize path ending without slash correctly', () => {
      const result = normalizePath('abc/xyz')

      expect(result.withSlash).toEqual('abc/xyz/')
      expect(result.withoutSlash).toEqual('abc/xyz')
    })
  })
})
