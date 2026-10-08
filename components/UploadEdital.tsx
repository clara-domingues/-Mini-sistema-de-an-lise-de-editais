"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UploadEdital() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);

    if (file.type !== "application/pdf") return setErr("Envie apenas arquivos PDF.");
    if (file.size > 20 * 1024 * 1024) return setErr("O PDF deve ter no máximo 20 MB.");

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // remove caracteres problemáticos do nome do arquivo
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user!.id}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage.from("editais").upload(path, file);
    if (upErr) { setErr(upErr.message); setLoading(false); return; }

    const { data: bid, error: insErr } = await supabase
      .from("bids")
      .insert({ file_path: path, title: file.name })
      .select()
      .single();
    if (insErr || !bid) { setErr(insErr?.message ?? "Erro ao criar edital."); setLoading(false); return; }

    // a função responde na hora (202) e processa em segundo plano
    await supabase.functions.invoke("analyze-bid", { body: { bid_id: bid.id } });

    router.push(`/editais/${bid.id}`);
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="font-semibold text-slate-800 mb-2">Enviar novo edital</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        disabled={loading}
        className="text-sm"
      />
      {loading && <p className="text-sm text-slate-500 mt-2">Enviando...</p>}
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}