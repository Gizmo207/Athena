module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.{js,ts}'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  preset: 'ts-jest',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
