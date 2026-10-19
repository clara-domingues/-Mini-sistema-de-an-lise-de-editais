
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTenantId } from "@/lib/tenant";

export default function UploadEdital() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const input = e.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    setErr(null);

    if (file.type !== "application/pdf") {
      setErr("Envie apenas arquivos PDF.");
      input.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErr("O PDF deve ter no máximo 20 MB.");
      input.value = "";
      return;
    }

    setLoading(true);

    let uploadedPath: string | null = null;

    try {
      const tenantId = await getTenantId(supabase);

      if (!tenantId) {
        throw new Error(
          "Sua conta não está associada a nenhuma empresa."
        );
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const path = `${tenantId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("editais")
        .upload(path, file);

      if (uploadError) {
        throw new Error(
          `Não foi possível enviar o PDF: ${uploadError.message}`
        );
      }

      uploadedPath = path;

      const { data: bid, error: insertError } = await supabase
        .from("bids")
        .insert({
          file_path: path,
          title: file.name,
          tenant_id: tenantId,
        })
        .select("id")
        .single();

      if (insertError || !bid) {
        throw new Error(
          insertError?.message ?? "Erro ao criar o edital."
        );
      }

      const { error: analysisError } =
        await supabase.functions.invoke("analyze-bid", {
          body: { bid_id: bid.id },
        });

      if (analysisError) {
        console.error(
          "Falha ao iniciar a análise:",
          analysisError
        );

        setErr(
          "O edital foi enviado, mas não foi possível iniciar a análise. " +
          "Verifique a função analyze-bid antes de tentar novamente."
        );

        router.push(`/editais/${bid.id}`);
        return;
      }

      router.push(`/editais/${bid.id}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado durante o envio.";

      setErr(message);

      // Não excluímos automaticamente o arquivo:
      // ele pode já estar vinculado a um edital criado.
      console.error("Erro no upload do edital:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <h2 className="mb-2 font-semibold text-slate-800">
        Enviar novo edital
      </h2>

      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        disabled={loading}
        className="text-sm"
      />

      {loading && (
        <p className="mt-2 text-sm text-slate-500">
          Enviando...
        </p>
      )}

      {err && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
