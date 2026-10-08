"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import { baixarDocx } from "@/lib/exportDocx";
export const dynamic = "force-dynamic";

type Item = {
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario_estimado: number | null;
};

type Extracted = {
  objeto: string;
  orgao: string;
  modalidade: string;
  datas: { vigencia: string | null };
  itens: Item[];
};

type Bid = { id: string; title: string | null; extracted_data: Extracted | null };

type Profile = {
  razao_social: string | null;
  cnpj: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_cargo: string | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const limpa = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

export default function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [supabase] = useState(() => createClient());
  const [bid, setBid] = useState<Bid | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [b, p, pr] = await Promise.all([
        supabase.from("bids").select("id,title,extracted_data").eq("id", id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("proposals").select("*").eq("bid_id", id).maybeSingle(),
      ]);
      if (cancelled) return;
      setBid(b.data as Bid | null);
      setProfile(p.data as Profile | null);
      if (pr.data) {
        setContent(pr.data.content_markdown ?? "");
        setPrices((pr.data.prices as Record<string, string>) ?? {});
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [id, supabase]);

  const d = bid?.extracted_data;
  const itens = d?.itens ?? [];
  const total = itens.reduce(
    (s, it, k) => s + (Number(prices[k]) || 0) * (it.quantidade ?? 1),
    0
  );

  function gerar() {
    if (!d) return;
    if (content && !confirm("Isso vai substituir o texto atual. Continuar?")) return;
    const p = profile;
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    const linhas = itens.map((it, k) => {
      const unit = Number(prices[k]) || 0;
      const qtd = it.quantidade ?? 1;
      return `| ${k + 1} | ${limpa(it.descricao)} | ${it.unidade ?? "un"} | ${qtd} | ${brl(unit)} | ${brl(unit * qtd)} |`;
    });

    const md = `# PROPOSTA COMERCIAL

**Ao:** ${d.orgao ?? "Ã“rgÃ£o Licitante"}  
**Ref.:** ${d.modalidade ?? "Processo LicitatÃ³rio"}

## 1. IdentificaÃ§Ã£o do proponente
**RazÃ£o Social:** ${p?.razao_social ?? "NÃ£o informado"}  
**CNPJ:** ${p?.cnpj ?? "NÃ£o informado"}  
**Representante legal:** ${p?.responsavel_nome ?? "NÃ£o informado"}, ${p?.responsavel_cargo ?? "Representante Legal"}, CPF ${p?.responsavel_cpf ?? "NÃ£o informado"}

## 2. Objeto
${d.objeto ?? "Objeto conforme edital."}

## 3. PreÃ§os
| Item | DescriÃ§Ã£o | Un. | Qtd. | Valor unitÃ¡rio | Valor total |
|---|---|---|---|---|---|
${linhas.join("\n")}

**Valor global da proposta: ${brl(total)}**

## 4. CondiÃ§Ãµes gerais
- Validade da proposta: 60 (sessenta) dias contados da data de abertura da sessÃ£o.
- Prazo de vigÃªncia: ${d.datas?.vigencia ?? "conforme edital"}.
- Declaramos que os preÃ§os acima incluem todos os custos, tributos, fretes e demais despesas necessÃ¡rias ao cumprimento do objeto.
- Declaramos que conhecemos e concordamos com todas as condiÃ§Ãµes do edital.

## 5. Dados bancÃ¡rios
**Banco:** ${p?.banco ?? "NÃ£o informado"}  
**AgÃªncia:** ${p?.agencia ?? "NÃ£o informado"}  
**Conta:** ${p?.conta ?? "NÃ£o informado"}

Data: ${hoje}

**${p?.responsavel_nome ?? "Representante Legal"}**  
${p?.responsavel_cargo ?? ""}  
${p?.razao_social ?? ""}`;

    setContent(md);
    setMsg(null);
  }

  async function salvar() {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("proposals").upsert(
      { bid_id: id, prices, content_markdown: content, updated_at: new Date().toISOString() },
      { onConflict: "bid_id" }
    );
    setSaving(false);
    setMsg(error ? { type: "err", text: error.message } : { type: "ok", text: "Proposta salva!" });
  }

  return (
    <>
      <div className="print:hidden"><Nav /></div>
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link href={`/editais/${id}`} className="text-sm text-blue-600 print:hidden">
          â† Voltar ao edital
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 print:hidden">Proposta comercial</h1>
        {!loaded && <p className="text-slate-500">Carregando...</p>}
        {loaded && !d && <p className="text-red-600">Edital nÃ£o analisado ou nÃ£o encontrado.</p>}
        {loaded && d && (
          <>
            {!profile?.razao_social && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm print:hidden">
                O perfil da empresa estÃ¡ vazio.{" "}
                <Link href="/perfil" className="underline font-semibold">Preencha o perfil</Link> antes de gerar a proposta.
              </div>
            )}
            <section className="bg-white rounded-xl shadow p-5 space-y-3 print:hidden">
              <h2 className="font-semibold text-slate-800">1. Informe os seus preÃ§os</h2>
              {itens.length === 0 && <p className="text-sm text-slate-500">Nenhum item extraÃ­do.</p>}
              {itens.map((it, k) => (
                <div key={k} className="grid grid-cols-[1fr_auto] gap-3 items-center text-sm border-b pb-2 last:border-0">
                  <div>
                    <p className="text-slate-900 font-medium">{it.descricao}</p>
                    <p className="text-xs text-slate-500">
                      {it.quantidade ?? 1} {it.unidade ?? "un"}
                      {it.valor_unitario_estimado != null && ` Â· estimado ${brl(it.valor_unitario_estimado)}`}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Valor unit. (R$)"
                    value={prices[k] ?? ""}
                    onChange={(e) => setPrices({ ...prices, [k]: e.target.value })}
                    className="w-36 border rounded-lg px-2 py-1 text-right"
                  />
                </div>
              ))}
              <p className="text-sm font-semibold text-slate-800">Total: {brl(total)}</p>
              <button onClick={gerar} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 font-medium">
                Gerar texto da proposta
              </button>
            </section>

            <section className="bg-white rounded-xl shadow p-5 space-y-2 print:hidden">
              <h2 className="font-semibold text-slate-800">2. Edite o texto (Markdown)</h2>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder="Clique em â€œGerar texto da propostaâ€ para comeÃ§ar."
                className="w-full border rounded-lg p-3 font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={salvar}
                  disabled={saving || !content}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvando"}
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={!content}
                  className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                  Baixar PDF
                </button>
                <button
                  onClick={() => baixarDocx(content, `proposta-${id.slice(0, 8)}`)}
                  disabled={!content}
                  className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                  Baixar DOCX
                </button>
              </div>
              {msg && (
                <p className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
              )}
            </section>

            {content && (
              <section className="bg-white rounded-xl shadow p-8 print:shadow-none print:p-0">
                <div className="proposta">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
