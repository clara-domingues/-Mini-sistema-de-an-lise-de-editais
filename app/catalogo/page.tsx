"use client";

import { useEffect, useState, type FormEvent } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, maskBRLInput, parseBRLInput } from "@/lib/currency";
import { errMessage } from "@/lib/errors";
import { getTenantId } from "@/lib/tenant";

type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  estimated_price: number;
  item_type: "product" | "service";
  created_at: string;
};

export default function CatalogoPage() {
  const supabase = createClient();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("UN");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [itemType, setItemType] = useState<"product" | "service">("product");

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      try {
        const tenantId = await getTenantId(supabase);
        if (!tenantId) return;

        const { data, error } = await supabase
          .from("catalog_items")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name", { ascending: true });

        if (error) throw error;
        if (isMounted) {
          setItems(data ?? []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMsg(errMessage(err, "Não foi possível carregar o catálogo."));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleCreateItem(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const tenantId = await getTenantId(supabase);
      if (!tenantId) throw new Error("Tenant não encontrado.");

      const { error } = await supabase.from("catalog_items").insert({
        tenant_id: tenantId,
        name: name.trim(),
        description: description.trim() || null,
        unit: unit.trim() || "UN",
        estimated_price: parseBRLInput(estimatedPrice) ?? 0,
        item_type: itemType,
      });

      if (error) throw new Error(error.message);

      // Limpar form e fechar modal
      setName("");
      setDescription("");
      setUnit("UN");
      setEstimatedPrice("");
      setItemType("product");
      setModalOpen(false);

      // Recarregar lista
      const tenantIdReload = await getTenantId(supabase);
      if (tenantIdReload) {
        const { data } = await supabase
          .from("catalog_items")
          .select("*")
          .eq("tenant_id", tenantIdReload)
          .order("name", { ascending: true });
        setItems(data ?? []);
      }
    } catch (err: unknown) {
      setErrorMsg(errMessage(err, "Não foi possível salvar o item."));
    } finally {
      setSaving(false);
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
                Catálogo de Produtos & Serviços
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Gerencie os itens e serviços recorrentes utilizados nas propostas de editais.
              </p>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:ring-4 focus:ring-blue-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Novo item
            </button>
          </header>

          {errorMsg && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
              Carregando catálogo...
            </div>
          ) : items.length === 0 ? (
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">Nenhum item cadastrado</h3>
              <p className="mt-1 text-sm text-slate-500">Adicione produtos ou serviços ao seu catálogo para iniciar a gestão.</p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Cadastrar primeiro item
              </button>
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <th className="px-6 py-4">Nome do item</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Unidade</th>
                    <th className="px-6 py-4">Preço Estimado (R$)</th>
                    <th className="px-6 py-4">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{i.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          i.item_type === "product" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        }`}>
                          {i.item_type === "product" ? "Produto" : "Serviço"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono">{i.unit || "UN"}</td>
                      <td className="px-6 py-4 text-slate-900 font-semibold">
                        {formatBRL(i.estimated_price)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{i.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal de Novo Item */}
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900">Novo item no catálogo</h2>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateItem} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Nome do Item *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Licença de Software / Notebook i7"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Tipo</label>
                      <select
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value as "product" | "service")}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                      >
                        <option value="product">Produto</option>
                        <option value="service">Serviço</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Unidade</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="UN, H, M2..."
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Preço (R$)</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={estimatedPrice}
                          onChange={(e) => setEstimatedPrice(maskBRLInput(e.target.value))}
                          placeholder="0,00"
                          className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">Descrição</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detalhes técnicos ou especificações do item"
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none"
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
                      className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {saving ? "Salvando..." : "Salvar item"}
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