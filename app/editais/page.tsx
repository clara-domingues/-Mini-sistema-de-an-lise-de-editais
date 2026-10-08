"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import UploadEdital from "@/components/UploadEdital";

type Bid = {
  id: string;
  title: string | null;
  status: string;
  decision: string | null;
  created_at: string;
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  uploaded: { text: "Enviado", cls: "bg-slate-100 text-slate-700" },
  processing: { text: "Analisando…", cls: "bg-yellow-100 text-yellow-800" },
  analyzed: { text: "Analisado", cls: "bg-green-100 text-green-800" },
  error: { text: "Erro", cls: "bg-red-100 text-red-800" },
};

export default function EditaisPage() {
  const [supabase] = useState(() => createClient());
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarEditais() {
      const { data } = await supabase
        .from("bids")
        .select("id,title,status,decision,created_at")
        .order("created_at", { ascending: false });

      setBids(data ?? []);
      setLoading(false);
    }

    carregarEditais();
  }, [supabase]);

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Editais</h1>
        <UploadEdital />

        <section className="space-y-2">
          {loading && <p className="text-slate-500">Carregando...</p>}
          {!loading && bids.length === 0 && (
            <p className="text-slate-500">Nenhum edital enviado ainda.</p>
          )}
          {bids.map((b) => {
            const s = statusLabel[b.status] ?? statusLabel.uploaded;
            return (
              <Link
                key={b.id}
                href={`/editais/${b.id}`}
                className="flex items-center justify-between bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="font-medium text-slate-900 line-clamp-1">
                    {b.title ?? "Sem título"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(b.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>
                  {s.text}
                </span>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}