/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = async() => {
  return {
    transform: {},
    modulePathIgnorePatterns: ["src"],
    verbose: true,
    testEnvironment: "node",
    moduleNameMapper: {
      "^jose/(.*)$": "<rootDir>/node_modules/jose-legacy"
    }
  }
}