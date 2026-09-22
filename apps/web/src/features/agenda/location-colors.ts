// Reexport fino — a paleta em si é compartilhada (ver
// apps/web/src/lib/palette-colors.ts), reaproveitada aqui só com os
// nomes já usados no resto da Agenda pra não precisar tocar em quem já
// importa daqui.
import type { PaletteColorToken as ApiPaletteColorToken } from "@dentist-system/shared-types";
import { PALETTE_COLOR_TOKENS, type PaletteColorToken as LocationColorToken } from "@/lib/palette-colors";

export {
  PALETTE_COLOR_TOKENS as LOCATION_COLOR_TOKENS,
  PALETTE_COLOR_HEX as LOCATION_COLOR_HEX,
  paletteColorForIndex as locationColorForIndex,
  type PaletteColorToken as LocationColorToken,
} from "@/lib/palette-colors";

// O backend usa os valores em maiúsculo (enum Prisma); o front sempre usou
// minúsculo (ver palette-colors.ts) — só a diferença de caixa, mesmos 5
// valores. Conversão pura, sem tabela de mapa.
export function fromApiColorToken(token: ApiPaletteColorToken | null | undefined): LocationColorToken | null {
  if (!token) return null;
  const lower = token.toLowerCase();
  return (PALETTE_COLOR_TOKENS as readonly string[]).includes(lower) ? (lower as LocationColorToken) : null;
}

export function toApiColorToken(token: LocationColorToken): ApiPaletteColorToken {
  return token.toUpperCase() as ApiPaletteColorToken;
}
