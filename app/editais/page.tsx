"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import ChatEditalModal from "@/components/ChatEditalModal";

type Client = {
  id: string;
  name: string;
};

type Bid = {
  id: string;
  title: string;
  client_id: string;
  status: string;
  estimated_value: number;
  deadline: string;
  clients?: Client;
};

const COLUMNS = [
  { id: "a_fazer", label: "A FAZER", color: "bg-amber-500" },
  { id: "analise_inicial", label: "ANÁLISE INICIAL", color: "bg-amber-400" },
  { id: "analise_ia", label: "ANÁLISE IA", color: "bg-purple-500" },
  { id: "validacao", label: "VALIDAÇÃO", color: "bg-blue-500" },
  { id: "concluido", label: "CONCLUÍDO", color: "bg-green-500" },
  { id: "cancelado", label: "CANCELADO", color: "bg-red-500" },
];

function normalizeStatus(raw: string | null | undefined): string {
  const id = (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return COLUMNS.some((c) => c.id === id) ? id : "a_fazer";
}

export default function EditaisKanbanPage() {
  const supabase = createClient();
  const [bids, setBids] = useState<Bid[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("a_fazer");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para cadastro rápido de novo cliente
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);

  async function fetchData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      let bidsData: Bid[] | null = null;
      const withJoin = await supabase.from("bids").select("*, clients(id, name)");

      if (withJoin.error) {
        console.error("Erro ao carregar editais (com cliente):", withJoin.error);
        const plain = await supabase.from("bids").select("*");
        if (plain.error) {
          console.error("Erro ao carregar editais:", plain.error);
          setErrorMsg(`Não foi possível carregar os editais: ${plain.error.message}`);
        } else {
          bidsData = plain.data as Bid[];
        }
      } else {
        bidsData = withJoin.data as Bid[];
      }

      const clientsRes = await supabase.from("clients").select("id, name").order("name");
      if (clientsRes.error) console.error("Erro ao carregar clientes:", clientsRes.error);

      const sorted = [...(bidsData || [])].sort((a, b) => {
        const ca = (a as { created_at?: string }).created_at || "";
        const cb = (b as { created_at?: string }).created_at || "";
        return cb.localeCompare(ca);
      });

      setBids(sorted);
      setClients(clientsRes.data || []);
    } catch (err) {
      console.error("Erro geral:", err);
      setErrorMsg("Erro inesperado ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleQuickCreateClient() {
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("clients")
        .insert([
          {
            name: newClientName.trim(),
            ...(user?.id ? { tenant_id: user.id } : {}),
          },
        ])
        .select("id, name")
        .single();

      if (error) {
        console.error("Erro detalhado do Supabase ao cadastrar cliente:", error);
        throw new Error(`Erro no Supabase (${error.code}): ${error.message}`);
      }

      if (data) {
        setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setClientId(data.id);
        setNewClientName("");
        setShowNewClientInput(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar cliente.";
      setErrorMsg(msg);
    } finally {
      setCreatingClient(false);
    }
  }

  async function handleCreateBid(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !clientId) {
      setErrorMsg("Preencha o título e selecione um cliente/órgão.");
      return;
    }

    setFormLoading(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let fileUrl = null;

      if (pdfFile) {
        const fileExt = pdfFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data: storageData, error: uploadErr } = await supabase.storage
          .from("editais")
          .upload(fileName, pdfFile);

        if (uploadErr) {
          console.warn("Aviso ao carregar PDF no storage:", uploadErr.message);
        } else if (storageData) {
          fileUrl = storageData.path;
        }
      }

      const { error } = await supabase.from("bids").insert([
        {
          title: title.trim(),
          client_id: clientId,
          status,
          estimated_value: estimatedValue ? parseFloat(estimatedValue) : 0,
          deadline: deadline || null,
          ...(fileUrl ? { pdf_url: fileUrl } : {}),
          ...(user?.id ? { tenant_id: user.id } : {}),
        },
      ]);

      if (error) {
        console.error("Erro do Supabase ao salvar edital:", error);
        throw new Error(`Erro (${error.code}): ${error.message}`);
      }

      setTitle("");
      setClientId("");
      setStatus("a_fazer");
      setEstimatedValue("");
      setDeadline("");
      setPdfFile(null);
      setShowNewClientInput(false);
      setModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar edital.";
      setErrorMsg(msg);
    } finally {
      setFormLoading(false);
    }
  }

  async function updateBidStatus(bidId: string, newStatus: string) {
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("bids")
      .update({ status: newStatus })
      .eq("id", bidId)
      .select("id");

    if (error) {
      console.error("Erro ao atualizar status:", error.message);
      setErrorMsg(`Não foi possível mover o edital: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setErrorMsg("Nenhuma linha foi atualizada. Verifique as permissões de UPDATE na tabela bids.");
      return;
    }

    setBids((prev) =>
      prev.map((b) => (b.id === bidId ? { ...b, status: newStatus } : b))
    );
  }

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  const errorBanner = errorMsg && (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {errorMsg}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      <Nav />
      <main className="flex-1 w-full overflow-hidden px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
        <div className="flex h-full min-h-0 w-full flex-col space-y-6">
          <header className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Editais & Kanban de Licitações
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Acompanhe o progresso das oportunidades, prazos e propostas em tempo real.
              </p>
            </div>

            <button
              onClick={() => {
                setErrorMsg(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              + Novo Edital
            </button>
          </header>

          {errorBanner}

          {loading ? (
            <div className="flex h-64 items-center justify-center text-slate-500">
              Carregando Kanban...
            </div>
          ) : (
            <div className="flex flex-1 gap-4 overflow-x-auto pb-6">
              {COLUMNS.map((col) => {
                const columnBids = bids.filter((b) => normalizeStatus(b.status) === col.id);
                return (
                  <div
                    key={col.id}
                    className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-200/70 p-4 border border-slate-300/60 max-h-[calc(100vh-220px)] overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-300">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${col.color}`} />
                        <h3 className="font-bold text-sm text-slate-800">{col.label}</h3>
                      </div>
                      <span className="rounded-full bg-slate-300/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {columnBids.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
                      {columnBids.length === 0 ? (
                        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
                          Sem editais
                        </div>
                      ) : (
                        columnBids.map((bid) => (
                          <Link
                            key={bid.id}
                            href={`/editais/${bid.id}`}
                            className="group relative flex flex-col rounded-xl bg-white p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition cursor-pointer"
                          >
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">
                              {bid.clients?.name || "Cliente não informado"}
                            </span>
                            <h4 className="font-semibold text-sm text-slate-900 mt-1 line-clamp-2 group-hover:text-blue-600 transition">
                              {bid.title}
                            </h4>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                              <span>{formatBRL(bid.estimated_value)}</span>
                              {bid.deadline && (
                                <span className="font-medium text-slate-600">
                                  📅 {new Date(bid.deadline).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-between pt-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedBid(bid);
                                  setChatOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition z-10"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                Chat IA
                              </button>

                              <select
                                value={normalizeStatus(bid.status)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  void updateBidStatus(bid.id, e.target.value);
                                }}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 outline-none focus:border-blue-600 z-10"
                              >
                                {COLUMNS.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Cadastro de Novo Edital */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-lg text-slate-900">Cadastrar Novo Edital</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateBid(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título do Edital *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Contratação de solução de software..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Cliente / Órgão *
                  </label>
                  {!showNewClientInput && (
                    <button
                      type="button"
                      onClick={() => setShowNewClientInput(true)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                    >
                      + Cadastrar novo órgão
                    </button>
                  )}
                </div>

                {!showNewClientInput ? (
                  <select
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white"
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome do novo órgão ou cliente..."
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      disabled={creatingClient || !newClientName.trim()}
                      onClick={() => void handleQuickCreateClient()}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingClient ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewClientInput(false);
                        setNewClientName("");
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data Limite / Prazo
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Documento / Ficheiro do Edital (PDF)
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-xl p-1.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Inicial no Kanban
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {formLoading ? "Salvando..." : "Salvar Edital"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBid && (
        <ChatEditalModal
          key={selectedBid.id}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          editalTitle={selectedBid.title || "Edital"}
          documentContext={`Título: ${selectedBid.title || "Não informado"}. Cliente: ${selectedBid.clients?.name || "Não informado"}. Valor: ${formatBRL(selectedBid.estimated_value)}.`}
        />
      )}
    </div>
  );
}