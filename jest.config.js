module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['<rootDir>/**/__tests__/**/*.(spec|test).ts'],
  testPathIgnorePatterns: ['<rootDir>/cdk.out/', '<rootDir>/dist/', '<rootDir>/packages/layers/core/nodejs/@types/'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|ts|tsx)$'],
  collectCoverageFrom: ['packages/functions/**/*.{ts,js}', '!packages/functions/**/index.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '@types'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  modulePathIgnorePatterns: ['<rootDir>/__tests__', '<rootDir>/packages/cdk/cdk.out'],
  moduleNameMapper: {
    '#node-web-compat': '<rootDir>/node_modules/aws-jwt-verify/dist/cjs/node-web-compat-web.js',
  },
  moduleDirectories: ['node_modules', 'packages/layers/core/nodejs/node_modules'],
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['jest-extended/all'],
}