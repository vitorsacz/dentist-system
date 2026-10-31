import { assertCurrentDatabase, assertTestDatabase } from "./db-guard";

describe("assertTestDatabase", () => {
  it("throws when undefined", () => {
    expect(() => assertTestDatabase(undefined)).toThrow("not set");
  });

  it("throws when empty string", () => {
    expect(() => assertTestDatabase("")).toThrow();
  });

  it("passes for localhost", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5433/dentist_test",
      ),
    ).not.toThrow();
  });

  it("passes for 127.0.0.1", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@127.0.0.1:5433/dentist_test",
      ),
    ).not.toThrow();
  });

  it("passes for ::1 (IPv6 loopback with brackets)", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@[::1]:5433/dentist_test",
      ),
    ).not.toThrow();
  });

  it("passes for [::1] (explicit bracket form)", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@[::1]:5433/dentist_test",
      ),
    ).not.toThrow();
  });

  it("throws for neon.tech host", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://user:pass@project.neon.tech/dentist_test",
      ),
    ).toThrow("remote host");
  });

  it("throws for supabase host", () => {
    expect(() =>
      assertTestDatabase("postgresql://user:pass@db.supabase.co/dentist_test"),
    ).toThrow("remote host");
  });

  it("throws for render host", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://user:pass@host.render.com/dentist_test",
      ),
    ).toThrow("remote host");
  });

  it("throws for non-local host", () => {
    expect(() =>
      assertTestDatabase("postgresql://user:pass@example.com/dentist_test"),
    ).toThrow("not local");
  });

  it("throws when db name lacks _test suffix", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5433/dentist_dev",
      ),
    ).toThrow("_test");
  });

  it("passes when db name ends in _test", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5432/dentist_system_test",
      ),
    ).not.toThrow();
  });

  it("passes with allowed query param schema", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5433/dentist_test?schema=public",
      ),
    ).not.toThrow();
  });

  it("throws for disallowed query param host", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5433/dentist_test?host=/tmp/pg",
      ),
    ).toThrow("query param not allowed: host");
  });

  it("throws for disallowed query param options", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5433/dentist_test?options=value",
      ),
    ).toThrow("query param not allowed: options");
  });

  it("throws for unknown query param", () => {
    expect(() =>
      assertTestDatabase(
        "postgresql://postgres:postgres@localhost:5433/dentist_test?foo=bar",
      ),
    ).toThrow("query param not allowed: foo");
  });
});

describe("assertCurrentDatabase", () => {
  it("passes for dentist_test", () => {
    expect(() => assertCurrentDatabase("dentist_test")).not.toThrow();
  });

  it("passes for dentist_system_test", () => {
    expect(() => assertCurrentDatabase("dentist_system_test")).not.toThrow();
  });

  it("throws for dentist_dev", () => {
    expect(() => assertCurrentDatabase("dentist_dev")).toThrow("_test");
  });

  it("throws for production", () => {
    expect(() => assertCurrentDatabase("production")).toThrow("_test");
  });

  it("throws for empty string", () => {
    expect(() => assertCurrentDatabase("")).toThrow("_test");
  });
});
