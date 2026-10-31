const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const FORBIDDEN_PROVIDERS = ["neon.tech", "supabase", "render"];
const ALLOWED_PARAMS = new Set(["schema", "connection_limit", "pool_timeout"]);

export function assertTestDatabase(rawUrl: string | undefined): void {
  if (!rawUrl) {
    throw new Error("Guard: TEST_DATABASE_URL is not set");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Guard: TEST_DATABASE_URL is not a valid URL");
  }

  const host = url.hostname.toLowerCase();

  for (const provider of FORBIDDEN_PROVIDERS) {
    if (host.includes(provider)) {
      throw new Error(`Guard: remote host forbidden: ${provider}`);
    }
  }

  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Guard: host is not local (got: ${host})`);
  }

  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Guard: database name must end in _test (got: ${dbName})`);
  }

  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_PARAMS.has(key)) {
      throw new Error(`Guard: query param not allowed: ${key}`);
    }
  }
}

export function assertCurrentDatabase(dbName: string): void {
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Guard: current database does not end in _test (got: ${dbName})`,
    );
  }
}
