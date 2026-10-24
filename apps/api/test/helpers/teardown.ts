import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL } from "../test-db";

// Limpa todas as tabelas do schema public (exceto _prisma_migrations) via
// TRUNCATE ... CASCADE. Recusa operar em banco que não seja localhost/de teste
// para evitar destruir produção por acidente.
export async function teardownAll(p: PrismaClient): Promise<void> {
  const url = TEST_DATABASE_URL;
  if (!/localhost|127\.0\.0\.1|_test/.test(url)) {
    throw new Error(
      `teardownAll: recusado — URL não aponta para banco local ou de teste: ${url}`,
    );
  }
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
