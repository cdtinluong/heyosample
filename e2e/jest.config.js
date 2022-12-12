module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['<rootDir>/src/*.(spec|test).ts'],
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|ts|tsx)$'],
  collectCoverageFrom: [],
  coveragePathIgnorePatterns: ['/node_modules/', '@types'],
  modulePathIgnorePatterns: [],
  moduleDirectories: ['node_modules'],
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['jest-extended/all'],
}
