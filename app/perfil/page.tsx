"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

type Profile = {
  razao_social: string;
  cnpj: string;
  banco: string;
  agencia: string;
  conta: string;
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_cargo: string;
};

const empty: Profile = {
  razao_social: "", cnpj: "", banco: "", agencia: "", conta: "",
  responsavel_nome: "", responsavel_cpf: "", responsavel_cargo: "",
};

const sections: { title: string; fields: { key: keyof Profile; label: string }[] }[] = [
  {
    title: "Dados da empresa",
    fields: [
      { key: "razao_social", label: "Razão Social" },
      { key: "cnpj", label: "CNPJ" },
    ],
  },
  {
    title: "Dados bancários",
    fields: [
      { key: "banco", label: "Banco" },
      { key: "agencia", label: "Agência" },
      { key: "conta", label: "Conta" },
    ],
  },
  {
    title: "Responsável legal",
    fields: [
      { key: "responsavel_nome", label: "Nome completo" },
      { key: "responsavel_cpf", label: "CPF" },
      { key: "responsavel_cargo", label: "Cargo" },
    ],
  },
];

export default function PerfilPage() {
  const supabase = createClient();
  const [form, setForm] = useState<Profile>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          razao_social: data.razao_social ?? "",
          cnpj: data.cnpj ?? "",
          banco: data.banco ?? "",
          agencia: data.agencia ?? "",
          conta: data.conta ?? "",
          responsavel_nome: data.responsavel_nome ?? "",
          responsavel_cpf: data.responsavel_cpf ?? "",
          responsavel_cargo: data.responsavel_cargo ?? "",
        });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user!.id, ...form });

    setSaving(false);
    setMsg(
      error
        ? { type: "err", text: error.message }
        : { type: "ok", text: "Perfil salvo com sucesso!" }
    );
  }

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Perfil da empresa</h1>
        <p className="text-sm text-slate-500 mb-6">
          Estes dados são usados automaticamente na geração das propostas.
        </p>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {sections.map((s) => (
              <section key={s.title} className="bg-white rounded-xl shadow p-5 space-y-3">
                <h2 className="font-semibold text-slate-800">{s.title}</h2>
                {s.fields.map((f) => (
                  <label key={f.key} className="block text-sm">
                    <span className="text-slate-600">{f.label}</span>
                    <input
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                    />
                  </label>
                ))}
              </section>
            ))}

            {msg && (
              <p className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                {msg.text}
              </p>
            )}

            <button
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 font-medium disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar perfil"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}