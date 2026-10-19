/** Extrai mensagem legível de erros do Supabase / JS. */
export function errMessage(err: unknown, fallback = "Erro inesperado."): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;

  if (typeof err === "object") {
    const obj = err as { message?: string; error_description?: string; details?: string };
    if (obj.message) return obj.message;
    if (obj.error_description) return obj.error_description;
    if (obj.details) return obj.details;
  }

  return fallback;
}
