// Só as 5 famílias de cor do design system oficial
// (design-system-plataforma-odontologica-tokens.json) — nenhum hex
// inventado. Usado pra diferenciar visualmente itens sem status
// semântico (consultório, categoria) — diferente do `Badge`
// (success/warning/error/neutral), que carrega significado.
// Hex cru (não classe Tailwind) onde precisar de style inline
// (ex.: FullCalendar define cor de evento via prop, não className).
export const PALETTE_COLOR_TOKENS = ["brand", "success", "warning", "error", "info"] as const;
export type PaletteColorToken = (typeof PALETTE_COLOR_TOKENS)[number];

export const PALETTE_COLOR_HEX: Record<PaletteColorToken, { solid: string; light: string }> = {
  brand: { solid: "#465FFF", light: "#ECF3FF" },
  success: { solid: "#12B76A", light: "#ECFDF3" },
  warning: { solid: "#F79009", light: "#FFFAEB" },
  error: { solid: "#F04438", light: "#FEF3F2" },
  info: { solid: "#0BA5EC", light: "#F0F9FF" },
};

export function paletteColorForIndex(index: number): PaletteColorToken {
  return PALETTE_COLOR_TOKENS[index % PALETTE_COLOR_TOKENS.length]!;
}
