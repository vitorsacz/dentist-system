import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./test-db";

export default async function globalSetup() {
  execSync("pnpm prisma migrate deploy", {
    cwd: __dirname + "/..",
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  });
}
