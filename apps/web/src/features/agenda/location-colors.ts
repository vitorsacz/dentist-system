// Reexport fino — a paleta em si é compartilhada (ver
// apps/web/src/lib/palette-colors.ts), reaproveitada aqui só com os
// nomes já usados no resto da Agenda pra não precisar tocar em quem já
// importa daqui.
export {
  PALETTE_COLOR_TOKENS as LOCATION_COLOR_TOKENS,
  PALETTE_COLOR_HEX as LOCATION_COLOR_HEX,
  paletteColorForIndex as locationColorForIndex,
  type PaletteColorToken as LocationColorToken,
} from "@/lib/palette-colors";
