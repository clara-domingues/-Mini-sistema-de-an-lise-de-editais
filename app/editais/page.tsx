"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import ChatEditalModal from "@/components/ChatEditalModal";
import { KANBAN_COLUNAS } from "@/lib/kanban-colunas";

const COLUMNS = KANBAN_COLUNAS.map((c) => ({
  id: c.slug,
  label: c.label.toUpperCase(),
  color: c.cor,
}));

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

  // Estados de Filtros e Busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  // Modal de Criação
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("a_fazer");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]); // Alterado para array de múltiplos ficheiros
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal de Edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBid, setEditingBid] = useState<Bid | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editStatus, setEditStatus] = useState("a_fazer");
  const [editEstimatedValue, setEditEstimatedValue] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editFormLoading, setEditFormLoading] = useState(false);

  // Estados para cadastro rápido de novo cliente
  const [showNewClientInput, setShowNewClientInput] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);

  async function loadData(showLoader = false) {
    if (showLoader) setLoading(true);
    setErrorMsg(null);
    try {
      let bidsData: Bid[] | null = null;
      const withJoin = await supabase.from("bids").select("*, clients(id, name)");

      if (withJoin.error) {
        const plain = await supabase.from("bids").select("*");
        if (plain.error) {
          setErrorMsg(`Não foi possível carregar os editais: ${plain.error.message}`);
        } else {
          bidsData = plain.data as Bid[];
        }
      } else {
        bidsData = withJoin.data as Bid[];
      }

      const clientsRes = await supabase.from("clients").select("id, name").order("name");

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
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);
      try {
        let bidsData: Bid[] | null = null;
        const withJoin = await supabase.from("bids").select("*, clients(id, name)");

        if (withJoin.error) {
          const plain = await supabase.from("bids").select("*");
          bidsData = plain.data as Bid[];
        } else {
          bidsData = withJoin.data as Bid[];
        }

        const clientsRes = await supabase.from("clients").select("id, name").order("name");

        if (isMounted) {
          const sorted = [...(bidsData || [])].sort((a, b) => {
            const ca = (a as { created_at?: string }).created_at || "";
            const cb = (b as { created_at?: string }).created_at || "";
            return cb.localeCompare(ca);
          });
          setBids(sorted);
          setClients(clientsRes.data || []);
        }
      } catch (err) {
        console.error("Erro:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void init();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

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
        throw new Error(`Erro no Supabase (${error.code}): ${error.message}`);
      }

      if (data) {
        setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setClientId(data.id);
        setEditClientId(data.id);
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

      // Se houver ficheiros selecionados, envia o primeiro (ou faz o loop de múltiplos conforme necessidade do storage)
      if (pdfFiles.length > 0) {
        const file = pdfFiles[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data: storageData, error: uploadErr } = await supabase.storage
          .from("editais")
          .upload(fileName, file);

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
        throw new Error(`Erro (${error.code}): ${error.message}`);
      }

      setTitle("");
      setClientId("");
      setStatus("a_fazer");
      setEstimatedValue("");
      setDeadline("");
      setPdfFiles([]);
      setShowNewClientInput(false);
      setModalOpen(false);
      await loadData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar edital.";
      setErrorMsg(msg);
    } finally {
      setFormLoading(false);
    }
  }

  function openEditModal(bid: Bid, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingBid(bid);
    setEditTitle(bid.title || "");
    setEditClientId(bid.client_id || "");
    setEditStatus(normalizeStatus(bid.status));
    setEditEstimatedValue(bid.estimated_value ? String(bid.estimated_value) : "");
    setEditDeadline(bid.deadline ? bid.deadline.split("T")[0] : "");
    setEditModalOpen(true);
  }

  async function handleUpdateBid(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBid) return;
    if (!editTitle.trim() || !editClientId) {
      setErrorMsg("Preencha o título e selecione um cliente/órgão para atualizar.");
      return;
    }

    setEditFormLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from("bids")
        .update({
          title: editTitle.trim(),
          client_id: editClientId,
          status: editStatus,
          estimated_value: editEstimatedValue ? parseFloat(editEstimatedValue) : 0,
          deadline: editDeadline || null,
        })
        .eq("id", editingBid.id);

      if (error) {
        throw new Error(`Erro ao atualizar: ${error.message}`);
      }

      setEditModalOpen(false);
      setEditingBid(null);
      await loadData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar edital.";
      setErrorMsg(msg);
    } finally {
      setEditFormLoading(false);
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
      setErrorMsg(`Não foi possível mover o edital: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setErrorMsg("Nenhuma linha foi atualizada.");
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

  const editaisFiltrados = bids.filter((bid) => {
    const atendeBusca =
      bid.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bid.clients?.name && bid.clients.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const atendeStatus = statusFilter === "TODOS" || normalizeStatus(bid.status) === statusFilter;

    return atendeBusca && atendeStatus;
  });

  const errorBanner = errorMsg && (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-800 dark:text-red-200">
      {errorMsg}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-100 dark:bg-slate-950 transition-colors">
      <Nav />
      <main className="flex-1 w-full overflow-hidden px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <div className="flex h-full min-h-0 w-full flex-col space-y-6">
          <header className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                Editais & Kanban de Licitações
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
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

          {/* Barra de Pesquisa e Filtros */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 transition-colors">
            <div className="w-full sm:w-80">
              <input
                type="text"
                placeholder="🔍 Buscar por edital ou órgão..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <label htmlFor="filtroStatusSelect" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Filtrar Coluna:</label>
              <select
                id="filtroStatusSelect"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TODOS">Todas as Colunas ({bids.length})</option>
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
              Carregando Kanban...
            </div>
          ) : (
            <div className="flex flex-1 gap-4 overflow-x-auto pb-6 min-w-0">
              {COLUMNS.map((col) => {
                const columnBids = editaisFiltrados.filter((b) => normalizeStatus(b.status) === col.id);
                return (
                  <div
                    key={col.id}
                    className="flex w-72 shrink-0 flex-col rounded-2xl bg-slate-200/70 dark:bg-slate-800/80 p-4 border border-slate-300/60 dark:border-slate-700 max-h-[calc(100vh-280px)] overflow-hidden shadow-sm transition-colors"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${col.color}`} />
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">{col.label}</h3>
                      </div>
                      <span className="rounded-full bg-slate-300/80 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {columnBids.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
                      {columnBids.length === 0 ? (
                        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
                          Sem editais
                        </div>
                      ) : (
                        columnBids.map((bid) => (
                          <Link
                            key={bid.id}
                            href={`/editais/${bid.id}`}
                            className="group relative flex flex-col rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide truncate max-w-[170px]">
                                {bid.clients?.name || "Cliente não informado"}
                              </span>

                              <button
                                type="button"
                                title="Editar Edital"
                                onClick={(e) => openEditModal(bid, e)}
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition z-10"
                              >
                                ✏️
                              </button>
                            </div>

                            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mt-1 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                              {bid.title}
                            </h4>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
                              <span>{formatBRL(bid.estimated_value)}</span>
                              {bid.deadline ? (
                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                  📅 {new Date(bid.deadline).toLocaleDateString("pt-BR")}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Data a definir</span>
                              )}
                            </div>

                            <div className="mt-3 flex items-center justify-between pt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedBid(bid);
                                  setChatOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition z-10"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                Chat IA
                              </button>

                              <select
                                value={normalizeStatus(bid.status)}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onChange={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void updateBidStatus(bid.id, e.target.value);
                                }}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-blue-600 z-10 cursor-pointer"
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
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Cadastrar Novo Edital</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateBid(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título do Edital *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Contratação de solução de software..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-950"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cliente / Órgão *
                  </label>
                  {!showNewClientInput && (
                    <button
                      type="button"
                      onClick={() => setShowNewClientInput(true)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition"
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
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
                      className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100 placeholder-slate-400"
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
                      className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data Limite / Prazo
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Upload Múltiplo de Documentos */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Documentos / Ficheiros do Edital (PDF/Outros)
                </label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="multiple-file-upload"
                    className="cursor-pointer rounded-xl bg-blue-50 dark:bg-blue-950 px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-slate-300 dark:border-slate-700 transition"
                  >
                    Escolher ficheiros
                  </label>
                  <input
                    id="multiple-file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      if (e.target.files) {
                        const selectedFiles = Array.from(e.target.files);
                        setPdfFiles((prev) => [...prev, ...selectedFiles]);
                      }
                    }}
                    className="hidden"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {pdfFiles.length === 0
                      ? "Nenhum ficheiro escolhido"
                      : `${pdfFiles.length} ficheiro(s) selecionado(s)`}
                  </span>
                </div>

                {/* Lista de ficheiros selecionados com opção de remoção */}
                {pdfFiles.length > 0 && (
                  <ul className="mt-2 max-h-28 overflow-y-auto space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {pdfFiles.map((file, index) => (
                      <li key={index} className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border border-slate-200 dark:border-slate-700">
                        <span className="truncate max-w-[280px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setPdfFiles(pdfFiles.filter((_, i) => i !== index))}
                          className="text-red-500 hover:text-red-700 font-bold ml-2"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status Inicial no Kanban
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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

      {/* Modal de Edição de Edital */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Editar Edital</h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleUpdateBid(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título do Edital *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cliente / Órgão *
                </label>
                <select
                  required
                  value={editClientId}
                  onChange={(e) => setEditClientId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editEstimatedValue}
                    onChange={(e) => setEditEstimatedValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data Limite / Prazo
                  </label>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status no Kanban
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editFormLoading}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editFormLoading ? "Atualizando..." : "Atualizar Edital"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Chat IA / Análise */}
      {chatOpen && selectedBid && (
        <ChatEditalModal
          isOpen={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setSelectedBid(null);
          }}
        
          editalTitle={selectedBid.title}
        />
      )}
    </div>
  );
}