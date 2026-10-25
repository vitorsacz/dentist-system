// Função pura exportada para permitir testes unitários sem importar seed.ts
// (que tem side-effects de módulo: PrismaClient + process.exit).
export function chooseSeed(appEnv: string): "hml" | "bootstrap" {
  return appEnv === "hml" ? "hml" : "bootstrap";
}
