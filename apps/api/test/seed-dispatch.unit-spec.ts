import { chooseSeed } from "../prisma/seed-dispatch";
import { validateNeonHost } from "../prisma/scripts/seed-hml-personas";

describe("chooseSeed", () => {
  it("APP_ENV=prod → bootstrap (nunca bloqueia seed legítimo)", () => {
    expect(chooseSeed("prod")).toBe("bootstrap");
  });

  it("APP_ENV=dev → bootstrap", () => {
    expect(chooseSeed("dev")).toBe("bootstrap");
  });

  it("APP_ENV=hml → hml (personas fictícias)", () => {
    expect(chooseSeed("hml")).toBe("hml");
  });
});

describe("validateNeonHost", () => {
  it("URL neon.tech válida → não lança", () => {
    expect(() =>
      validateNeonHost("X", "postgresql://user:pass@ep-silent-fog.us-east-2.aws.neon.tech/mydb"),
    ).not.toThrow();
  });

  it("URL supabase → lança com menção a neon.tech", () => {
    expect(() =>
      validateNeonHost("X", "postgresql://user:pass@db.fjkzcqcimtlrddhvmkgr.supabase.co/postgres"),
    ).toThrow(/neon\.tech/);
  });

  it("localhost → lança (não é neon.tech)", () => {
    expect(() =>
      validateNeonHost("X", "postgresql://postgres@localhost:5432/dentist_system"),
    ).toThrow(/neon\.tech/);
  });

  it("variável não definida → lança", () => {
    expect(() => validateNeonHost("NONEXISTENT_VAR_HML_SEED_999")).toThrow(/não está definida/);
  });
});
