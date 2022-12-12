module.exports = {
  roots: ['<rootDir>'],
  testMatch: ['<rootDir>/**/__tests__/**/*.(spec|test).ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|ts|tsx)$'],
  testEnvironment: 'node',
}
