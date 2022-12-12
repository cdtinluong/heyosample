import { isIsoDate } from '../utils'

describe('polling/utils.ts', () => {
  describe('isIsoDate', () => {
    it('Should return true when valid isIsoDate', () => {
      expect(isIsoDate('2022-10-25T17:40:48.789Z')).toEqual(true)
    })

    it('Should return false when invalid isIsoDate', () => {
      expect(isIsoDate('2022-10-25T17:40:48.780')).toEqual(false)
    })

    it('Should return false when invalid date', () => {
      expect(isIsoDate('test')).toEqual(false)
    })
  })
})
