import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "./test-db";

// Testa as migrations de R1 pela cadeia real: aplica todas as migrations ANTES
// delas num schema Postgres descartável, insere usuários no formato antigo
// (coluna "role") e aplica em ordem:
// 1) expandir (add_user_roles): cria "roles" e copia o papel;
// 2) contrair (drop_user_role): repreenche quem escapou e remove "role".
//
// Usa `prisma migrate deploy` de verdade (o mesmo do build do Render), com
// uma pasta temporária de migrations — não depende do schema.prisma atual.

const SCHEMA = "r1_migration_test";
const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");
const ADD_ROLES = "_add_user_roles";
const DROP_ROLE = "_drop_user_role";

function urlForSchema(schema: string) {
  const url = new URL(TEST_DATABASE_URL);
  url.searchParams.set("schema", schema);
  return url.toString();
}

describe("Migrations R1: role → roles (expandir → contrair)", () => {
  const base = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  const scoped = new PrismaClient({ datasources: { db: { url: urlForSchema(SCHEMA) } } });
  const workDir = mkdtempSync(join(tmpdir(), "r1-migration-"));
  const workMigrations = join(workDir, "migrations");
  const allMigrations = readdirSync(MIGRATIONS_DIR).filter((name) => /^\d{14}_/.test(name)).sort();
  const addRolesIndex = allMigrations.findIndex((name) => name.endsWith(ADD_ROLES));
  const dropRoleIndex = allMigrations.findIndex((name) => name.endsWith(DROP_ROLE));

  function copyMigrations(names: string[]) {
    for (const name of names) {
      cpSync(join(MIGRATIONS_DIR, name), join(workMigrations, name), { recursive: true });
    }
  }

  function migrateDeploy() {
    execSync(`pnpm prisma migrate deploy --schema "${join(workDir, "schema.prisma")}"`, {
      cwd: join(__dirname, ".."),
      stdio: "pipe",
      env: { ...process.env, MIGRATION_TEST_URL: urlForSchema(SCHEMA) },
    });
  }

  async function columnExists(column: string) {
    const rows = await base.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'User' AND column_name = $2`,
      SCHEMA,
      column,
    );
    return rows.length > 0;
  }

  async function rolesByEmail() {
    const rows = await scoped.$queryRawUnsafe<{ email: string; roles: string[] }[]>(
      `SELECT email, roles::text[] AS roles FROM "User" ORDER BY email`,
    );
    return Object.fromEntries(rows.map((row) => [row.email, row.roles]));
  }

  beforeAll(async () => {
    expect(addRolesIndex).toBeGreaterThan(0);
    expect(dropRoleIndex).toBe(addRolesIndex + 1);
    await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    writeFileSync(
      join(workDir, "schema.prisma"),
      `datasource db {\n  provider = "postgresql"\n  url      = env("MIGRATION_TEST_URL")\n}\n`,
    );
    cpSync(join(MIGRATIONS_DIR, "migration_lock.toml"), join(workMigrations, "migration_lock.toml"));

    // Banco no estado de ANTES do R1.
    copyMigrations(allMigrations.slice(0, addRolesIndex));
    migrateDeploy();
  }, 120000);

  afterAll(async () => {
    await base.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await scoped.$disconnect();
    await base.$disconnect();
    rmSync(workDir, { recursive: true, force: true });
  });

  it("cada usuário termina com roles = [papel antigo]; Super Admin com []", async () => {
    expect(await columnExists("role")).toBe(true);
    expect(await columnExists("roles")).toBe(false);

    await scoped.$executeRawUnsafe(
      `INSERT INTO "Organization" (id, name, "updatedAt") VALUES ('org1', 'Clínica', NOW())`,
    );
    const insertUser = (id: string, organizationId: string | null, role: string | null, superAdmin = false) =>
      scoped.$executeRawUnsafe(
        `INSERT INTO "User" (id, "organizationId", email, "passwordHash", name, role, "isSuperAdmin", "updatedAt")
         VALUES ($1, $2, $3, 'x', $1, $4::"Role", $5, NOW())`,
        id,
        organizationId,
        `${id}@test.com`,
        role,
        superAdmin,
      );
    await insertUser("admin", "org1", "ADMIN");
    await insertUser("dentista", "org1", "DENTIST");
    await insertUser("recepcao", "org1", "RECEPTIONIST");
    await insertUser("super", null, null, true);

    copyMigrations([allMigrations[addRolesIndex] as string]);
    migrateDeploy();

    expect(await rolesByEmail()).toEqual({
      "admin@test.com": ["ADMIN"],
      "dentista@test.com": ["DENTIST"],
      "recepcao@test.com": ["RECEPTIONIST"],
      "super@test.com": [],
    });
    // Expandir, não contrair: a coluna antiga continua lá até a próxima migration.
    expect(await columnExists("role")).toBe(true);
  }, 120000);

  it("contrair: quem a API antiga criou depois da primeira migration é repreenchido; role some", async () => {
    // Retardatários: gravados pela API antiga (só "role") entre a migration de
    // expandir e a troca de versão no Render. Um pegou o DEFAULT [], o outro
    // ficou com NULL.
    await scoped.$executeRawUnsafe(
      `INSERT INTO "User" (id, "organizationId", email, "passwordHash", name, role, "updatedAt")
       VALUES ('tardio1', 'org1', 'tardio1@test.com', 'x', 'tardio1', 'DENTIST', NOW()),
              ('tardio2', 'org1', 'tardio2@test.com', 'x', 'tardio2', 'RECEPTIONIST', NOW())`,
    );
    await scoped.$executeRawUnsafe(`UPDATE "User" SET roles = NULL WHERE id = 'tardio2'`);

    copyMigrations([allMigrations[dropRoleIndex] as string]);
    migrateDeploy();

    expect(await rolesByEmail()).toEqual({
      "admin@test.com": ["ADMIN"],
      "dentista@test.com": ["DENTIST"],
      "recepcao@test.com": ["RECEPTIONIST"],
      "super@test.com": [],
      "tardio1@test.com": ["DENTIST"],
      "tardio2@test.com": ["RECEPTIONIST"],
    });
    expect(await columnExists("role")).toBe(false);
  }, 120000);
});
