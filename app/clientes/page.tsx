"use client";

import { useEffect, useState, type FormEvent } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import { getTenantId } from "@/lib/tenant";

type Client = {
  id: string;
  name: string;
  document: string | null;
  doc_type: "CNPJ" | "CPF";
  type: string | null;
  city: string | null;
  sector: string | null;
  address: string | null;
  created_at: string;
};

const SECTORS_LIST = [
  "Tecnologia da Informação",
  "Telecomunicações",
  "Obras e Engenharia Civil",
  "Manutenção Predial",
  "Saúde e Hospitalar",
  "Educação e Treinamentos",
  "Segurança e Vigilância",
  "Limpeza e Conservação",
  "Alimentação e Refeições",
  "Transporte e Logística",
  "Mobiliário e Equipamentos",
  "Material de Consumo / Expediente",
  "Energia e Sustentabilidade",
  "Consultoria e Serviços Especializados",
  "Meio Ambiente",
  "Agronegócio",
  "Indústria e Manufatura",
  "Outro",
];

export default function ClientesPage() {
  const [supabase] = useState(() => createClient());
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<"CNPJ" | "CPF">("CNPJ");
  const [document, setDocument] = useState("");
  const [clientType, setClientType] = useState("Público");
  const [city, setCity] = useState("");
  const [sector, setSector] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchClients() {
      try {
        const tenantId = await getTenantId(supabase);
        if (!tenantId || !active) return;

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name", { ascending: true });

        if (error) throw error;
        if (active) setClients(data ?? []);
      } catch (err: unknown) {
        if (active && err instanceof Error) setErrorMsg(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchClients();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function reloadClients() {
    const tenantId = await getTenantId(supabase);
    if (!tenantId) return;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error) setErrorMsg(error.message);
    else setClients(data ?? []);
  }

  function handleOpenCreateModal() {
    setEditingClient(null);
    setName("");
    setDocType("CNPJ");
    setDocument("");
    setClientType("Público");
    setCity("");
    setSector("");
    setAddress("");
    setErrorMsg(null);
    setModalOpen(true);
  }

  function handleOpenEditModal(client: Client) {
    setEditingClient(client);
    setName(client.name || "");
    setDocType(client.doc_type || "CNPJ");
    setDocument(client.document || "");
    setClientType(client.type || "Público");
    setCity(client.city || "");
    setSector(client.sector || "");
    setAddress(client.address || "");
    setErrorMsg(null);
    setModalOpen(true);
  }

  async function handleSaveClient(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const tenantId = await getTenantId(supabase);
      if (!tenantId) throw new Error("Organização não encontrada.");

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update({
            name: name.trim(),
            doc_type: docType,
            document: document.trim() || null,
            type: clientType,
            city: city.trim() || null,
            sector: sector || null,
            address: address.trim() || null,
          })
          .eq("id", editingClient.id)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({
          tenant_id: tenantId,
          name: name.trim(),
          doc_type: docType,
          document: document.trim() || null,
          type: clientType,
          city: city.trim() || null,
          sector: sector || null,
          address: address.trim() || null,
        });

        if (error) throw error;
      }

      setModalOpen(false);
      await reloadClients();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient(clientId: string) {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    setDeletingId(clientId);
    try {
      const tenantId = await getTenantId(supabase);
      if (!tenantId) return;

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
      await reloadClients();
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMsg(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      <Nav />
      <main className="flex-1 w-full overflow-y-auto px-8 py-8 text-slate-900 lg:px-12">
        <div className="w-full space-y-8">
          <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Clientes & Órgãos
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gerencie os órgãos públicos, empresas privadas e pessoas físicas parceiras.
              </p>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Novo cliente
            </button>
          </header>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
              Carregando clientes...
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Nenhum cliente cadastrado</h3>
              <p className="mt-1 text-sm text-slate-500">Cadastre seu primeiro cliente para começar a organizar as licitações.</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Cadastrar agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => (
                <div key={c.id} className="group relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3 transition hover:border-blue-300 hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      {c.type || "Geral"}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{c.doc_type || "CNPJ"}: {c.document || "Não informado"}</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{c.city || "Cidade não informada"} {c.sector ? `• ${c.sector}` : ""}</p>
                    {c.address && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{c.address}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditModal(c)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteClient(c.id)}
                      disabled={deletingId === c.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
                      title="Excluir cliente"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de Cadastro / Edição de Cliente */}
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-6 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingClient ? "Editar cliente / órgão" : "Cadastrar novo cliente"}
                  </h2>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveClient} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Nome / Órgão *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Prefeitura Municipal de Fortaleza"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Documento</label>
                        <div className="flex gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => { setDocType("CNPJ"); setDocument(""); }}
                            className={`px-2 py-0.5 rounded font-bold transition-colors ${docType === "CNPJ" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            CNPJ
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDocType("CPF"); setDocument(""); }}
                            className={`px-2 py-0.5 rounded font-bold transition-colors ${docType === "CPF" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                          >
                            CPF
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={document}
                        onChange={(e) => setDocument(e.target.value)}
                        placeholder={docType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Tipo</label>
                      <select
                        value={clientType}
                        onChange={(e) => setClientType(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="Público">Público</option>
                        <option value="Privado">Privado</option>
                        <option value="Pessoa Física">Pessoa Física</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Cidade</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex: Fortaleza - CE"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Ramo / Setor</label>
                      <select
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="">Selecione o setor...</option>
                        {SECTORS_LIST.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Endereço</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Endereço completo"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Salvando..." : editingClient ? "Atualizar cliente" : "Salvar cliente"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}