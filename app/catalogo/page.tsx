
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import {
  formatBRL,
  maskBRLInput,
  parseBRLInput,
} from "@/lib/currency";
import { errMessage } from "@/lib/errors";
import { getTenantId } from "@/lib/tenant";

type CatalogItem = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  details: string | null;
  unit: string | null;
  unit_price: number | null;
  estimated_price: number | null;
  type: "produto" | "serviço";
  item_type: string | null;
  active: boolean;
  created_at: string;
};

export default function CatalogoPage() {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("UN");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [itemType, setItemType] = useState<"product" | "service">(
    "product"
  );

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const loadCatalog = useCallback(async () => {
    setErrorMsg(null);

    try {
      const tenantId = await getTenantId(supabase);

      if (!tenantId) {
        throw new Error(
          "Sua conta não está associada a uma empresa. Verifique o cadastro do tenant."
        );
      }

      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      if (error) throw error;

      setItems((data ?? []) as CatalogItem[]);
    } catch (err: unknown) {
      setErrorMsg(
        errMessage(err, "Não foi possível carregar o catálogo.")
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    // Agenda o carregamento fora da execução síncrona do efeito.
    const timer = window.setTimeout(() => {
      if (active) {
        void loadCatalog();
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadCatalog]);

  const filteredItems = items.filter((item) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    const matchesSearch =
      !query ||
      item.name.toLocaleLowerCase("pt-BR").includes(query) ||
      (item.description ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(query) ||
      (item.details ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(query);

    const type = item.type === "serviço" ? "service" : "product";
    const matchesType =
      filterType === "all" || type === filterType;

    return matchesSearch && matchesType;
  });

  const productCount = items.filter(
    (item) => item.type === "produto"
  ).length;

  const serviceCount = items.filter(
    (item) => item.type === "serviço"
  ).length;

  const totalValue = items.reduce((total, item) => {
    const price = Number(
      item.estimated_price ?? item.unit_price ?? 0
    );

    return total + (Number.isFinite(price) ? price : 0);
  }, 0);

  function resetForm() {
    setName("");
    setDescription("");
    setUnit("UN");
    setEstimatedPrice("");
    setItemType("product");
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    resetForm();
  }

  async function handleCreateItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const tenantId = await getTenantId(supabase);

      if (!tenantId) {
        throw new Error(
          "Sua conta não está associada a nenhuma empresa."
        );
      }

      const cleanName = name.trim();
      const cleanDescription = description.trim();
      const price = parseBRLInput(estimatedPrice);

      if (!cleanName) {
        throw new Error("Informe o nome do produto ou serviço.");
      }

      if (price === null || price < 0) {
        throw new Error(
          "Informe um preço válido, igual ou superior a zero."
        );
      }

      const databaseType =
        itemType === "product" ? "produto" : "serviço";

      const { error } = await supabase
        .from("catalog_items")
        .insert({
          tenant_id: tenantId,
          name: cleanName,
          type: databaseType,
          item_type: itemType,
          description: cleanDescription || null,
          details: cleanDescription || null,
          unit: unit.trim() || "UN",
          unit_price: price,
          estimated_price: price,
          active: true,
        });

      if (error) throw error;

      resetForm();
      setModalOpen(false);
      setSuccessMsg("Item cadastrado com sucesso.");

      await loadCatalog();
    } catch (err: unknown) {
      setErrorMsg(
        errMessage(err, "Não foi possível salvar o item.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      <Nav />

      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 text-slate-900 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-7xl space-y-7">
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <span>Gestão</span>
                <span>/</span>
                <span className="font-medium text-blue-700">
                  Catálogo
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Catálogo de produtos e serviços
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Organize seus produtos, serviços e preços para
                reutilizá-los na elaboração de propostas para editais.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setModalOpen(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Novo item
            </button>
          </header>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <p>{errorMsg}</p>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="shrink-0 font-semibold"
                aria-label="Fechar mensagem de erro"
              >
                ✕
              </button>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              <p>{successMsg}</p>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="font-semibold"
                aria-label="Fechar mensagem de sucesso"
              >
                ✕
              </button>
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Total de itens
                </span>
                <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M8 9h8M8 13h8M8 17h4" />
                  </svg>
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-950">
                {loading ? "—" : items.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Itens cadastrados na empresa
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Produtos
                </span>
                <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                    <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
                  </svg>
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-950">
                {loading ? "—" : productCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Produtos disponíveis no catálogo
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Serviços
                </span>
                <span className="rounded-lg bg-purple-50 p-2 text-purple-700">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-950">
                {loading ? "—" : serviceCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Serviços disponíveis no catálogo
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Soma dos preços unitários
                </span>
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
              </div>
              <p className="mt-4 break-words text-2xl font-bold text-slate-950">
                {loading ? "—" : formatBRL(totalValue)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Soma simples dos preços cadastrados
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Itens cadastrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Consulte e filtre os produtos e serviços da sua empresa.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m16 16 4 4" />
                  </svg>

                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou descrição..."
                    aria-label="Buscar itens do catálogo"
                    className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  aria-label="Filtrar por tipo"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="product">Produtos</option>
                  <option value="service">Serviços</option>
                </select>

                <button
                  type="button"
                  onClick={() => void loadCatalog()}
                  disabled={loading}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Atualizar lista
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
                <p className="mt-4 text-sm text-slate-500">
                  Carregando catálogo...
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M8 9h8M8 13h8M8 17h4" />
                  </svg>
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {items.length === 0
                    ? "Seu catálogo está vazio"
                    : "Nenhum item encontrado"}
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {items.length === 0
                    ? "Cadastre seus produtos e serviços para facilitar a criação de propostas para editais."
                    : "Tente alterar a busca ou selecionar outro tipo de item."}
                </p>

                {items.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
                  >
                    Cadastrar primeiro item
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-6 py-4">Produto ou serviço</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Unidade</th>
                        <th className="px-6 py-4">Preço unitário</th>
                        <th className="px-6 py-4">Descrição</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => {
                        const isService = item.type === "serviço";
                        const price =
                          item.estimated_price ?? item.unit_price;

                        return (
                          <tr
                            key={item.id}
                            className="transition-colors hover:bg-slate-50"
                          >
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">
                                {item.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                Cadastrado em{" "}
                                {new Date(
                                  item.created_at
                                ).toLocaleDateString("pt-BR")}
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  isService
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {isService ? "Serviço" : "Produto"}
                              </span>
                            </td>

                            <td className="px-6 py-4 font-mono text-slate-600">
                              {item.unit || "UN"}
                            </td>

                            <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">
                              {formatBRL(
                                price == null ? null : Number(price)
                              )}
                            </td>

                            <td className="max-w-xs px-6 py-4 text-slate-600">
                              <span className="line-clamp-2">
                                {item.description ||
                                  item.details ||
                                  "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Exibindo {filteredItems.length} de {items.length} itens
                  </span>
                  <span>
                    Os preços exibidos são os valores unitários cadastrados.
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-modal-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2
                  id="catalog-modal-title"
                  className="text-xl font-bold text-slate-950"
                >
                  Novo item no catálogo
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Preencha os dados do produto ou serviço.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Fechar formulário"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="catalog-name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Nome do item *
                </label>

                <input
                  id="catalog-name"
                  type="text"
                  required
                  maxLength={200}
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Notebook empresarial"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="catalog-type"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Tipo do item *
                </label>

                <select
                  id="catalog-type"
                  value={itemType}
                  onChange={(e) =>
                    setItemType(
                      e.target.value as "product" | "service"
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="product">Produto</option>
                  <option value="service">Serviço</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="catalog-unit"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Unidade
                  </label>

                  <input
                    id="catalog-unit"
                    type="text"
                    maxLength={30}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="UN, H, M²..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="catalog-price"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Preço unitário (R$) *
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                      R$
                    </span>

                    <input
                      id="catalog-price"
                      type="text"
                      inputMode="decimal"
                      required
                      value={estimatedPrice}
                      onChange={(e) =>
                        setEstimatedPrice(
                          maskBRLInput(e.target.value)
                        )
                      }
                      placeholder="0,00"
                      className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="catalog-description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Descrição
                </label>

                <textarea
                  id="catalog-description"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Informe detalhes técnicos, especificações ou características."
                  className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar item"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
