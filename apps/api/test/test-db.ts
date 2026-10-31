import { assertTestDatabase } from "./db-guard";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/dentist_test";

assertTestDatabase(TEST_DATABASE_URL);
