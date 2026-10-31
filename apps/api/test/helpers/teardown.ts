import { PrismaClient } from "@prisma/client";
import { assertCurrentDatabase } from "../db-guard";

// Limpa todas as tabelas do schema public (exceto _prisma_migrations) via
// TRUNCATE ... CASCADE. Recusa operar em banco que não seja localhost/de teste
// para evitar destruir produção por acidente.
export async function teardownAll(p: PrismaClient): Promise<void> {
  const [row] = await p.$queryRaw<[{ current_database: string }]>`SELECT current_database()`;
  assertCurrentDatabase(row.current_database);
  await p.$executeRawUnsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}
