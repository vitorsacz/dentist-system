// Só as 5 famílias de cor do design system oficial
// (design-system-plataforma-odontologica-tokens.json) — nenhum hex
// inventado. Precisa ser hex cru (não classe Tailwind) porque o
// FullCalendar aplica backgroundColor/borderColor inline via prop de
// evento, não por className.
export const LOCATION_COLOR_TOKENS = ["brand", "success", "warning", "error", "info"] as const;
export type LocationColorToken = (typeof LOCATION_COLOR_TOKENS)[number];

export const LOCATION_COLOR_HEX: Record<LocationColorToken, { solid: string; light: string }> = {
  brand: { solid: "#465FFF", light: "#ECF3FF" },
  success: { solid: "#12B76A", light: "#ECFDF3" },
  warning: { solid: "#F79009", light: "#FFFAEB" },
  error: { solid: "#F04438", light: "#FEF3F2" },
  info: { solid: "#0BA5EC", light: "#F0F9FF" },
};

export function locationColorForIndex(index: number): LocationColorToken {
  return LOCATION_COLOR_TOKENS[index % LOCATION_COLOR_TOKENS.length]!;
}
