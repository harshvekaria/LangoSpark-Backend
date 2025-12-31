module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  // Run the server check test first
  testSequencer: './src/tests/custom-sequencer.js',
  // Add more time for tests that might include AI processing
  testTimeout: 15000,
  // Stop after first failure for faster feedback
  bail: 0,
  // Add globals for TypeScript
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  // Only run .test.ts files
  testMatch: ['**/*.test.ts'],
  // Don't run tests in node_modules
  testPathIgnorePatterns: ['/node_modules/'],
}; 