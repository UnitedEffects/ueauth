/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  transform: {},
  modulePathIgnorePatterns: ["src"],
  //verbose: true
  //"testEnvironment": "node",
  moduleNameMapper: {
    "^jose/(.*)$": "<rootDir>/node_modules/jose-legacy"
  }
}