/** Formata número como moeda brasileira (R$). */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Converte texto digitado (ex: 1.234,56) em número. */
export function parseBRLInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/** Máscara amigável para digitação em R$ (mantém vírgula decimal). */
export function maskBRLInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const asNumber = Number(digits) / 100;
  return asNumber.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
