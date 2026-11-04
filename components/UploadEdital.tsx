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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);

    if (files.length === 0) return;

    setErr(null);
    setLoading(true);

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    try {
      const tenantId = await getTenantId(supabase);
      if (!tenantId) {
        throw new Error("Sua conta não está associada a nenhuma empresa.");
      }

      let lastCreatedBidId: string | null = null;

      // Processa cada ficheiro selecionado
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`O arquivo ${file.name} não é um PDF ou documento compatível.`);
        }

        if (file.size > 50 * 1024 * 1024) {
          throw new Error(`O arquivo ${file.name} excede o limite de 50 MB.`);
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${tenantId}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("editais")
          .upload(path, file);

        if (uploadError) {
          throw new Error(`Não foi possível enviar ${file.name}: ${uploadError.message}`);
        }

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
          throw new Error(insertError?.message ?? `Erro ao criar o registo para ${file.name}.`);
        }

        lastCreatedBidId = bid.id;

        // Inicia a análise de IA para cada documento enviado
        await supabase.functions.invoke("analyze-bid", {
          body: { bid_id: bid.id },
        });
      }

      // Redireciona para o último edital enviado ou lista
      if (lastCreatedBidId) {
        router.push(`/editais/${lastCreatedBidId}`);
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado durante o envio.";

      setErr(message);
      console.error("Erro no upload dos editais:", error);
    } finally {
      setLoading(false);
      input.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow transition-colors">
      <h2 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">
        Enviar novos editais ou documentos (Múltiplos)
      </h2>

      <input
        type="file"
        multiple
        accept="application/pdf,.doc,.docx"
        onChange={handleFile}
        disabled={loading}
        className="text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"
      />

      {loading && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enviando e processando documentos...</p>
      )}

      {err && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {err}
        </p>
      )}
    </div>
  );
}