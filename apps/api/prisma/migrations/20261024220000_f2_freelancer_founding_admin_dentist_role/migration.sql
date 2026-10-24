-- Idempotente: adiciona papel DENTIST ao founding user de orgs FREELANCER
-- que ainda não o têm. Necessário para orgs criadas antes do F2 fix.
UPDATE "User" u
SET roles = array_append(u.roles, 'DENTIST'::"Role")
FROM "Organization" o
WHERE o."foundingAdminUserId" = u.id
  AND o.type = 'FREELANCER'::"TenantType"
  AND NOT ('DENTIST'::"Role" = ANY(u.roles));
