/** @type {import('jest').Config} */
module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.e2e-spec.ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  globalSetup: "<rootDir>/test/global-setup.ts",
  setupFiles: ["<rootDir>/test/env-setup.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
};
