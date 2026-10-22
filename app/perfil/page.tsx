"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import { SECTOR_OPTIONS } from "@/lib/sectors";

export default function PerfilEmpresaPage() {
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados dos campos da empresa
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [respName, setRespName] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respRole, setRespRole] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  
  // Estado para os setores selecionados
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  const supabase = createClient();

  // Carregar dados existentes do perfil ao abrir a página
  useEffect(() => {
    async function loadPerfil() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("tenant_id", user.id)
          .maybeSingle();

        if (!error && data) {
          setCompanyName(data.razao_social || "");
          setCnpj(data.cnpj || "");
          setBankName(data.banco || "");
          setBankAgency(data.agencia || "");
          setBankAccount(data.conta || "");
          setRespName(data.nome_completo || "");
          setRespCpf(data.cpf || "");
          setRespRole(data.cargo || "");
          setMinValue(data.min_value || "");
          setMaxValue(data.max_value || "");
          setSelectedSectors(data.sectors || []);
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      }
    }

    void loadPerfil();
  }, [supabase]);

  // Alterna a seleção do setor
  const toggleSector = (sector: string) => {
    if (selectedSectors.includes(sector)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sector));
    } else {
      setSelectedSectors([...selectedSectors, sector]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Utilizador não autenticado.");
      }

      const payload = {
        tenant_id: user.id,
        razao_social: companyName,
        cnpj,
        banco: bankName,
        agencia: bankAgency,
        conta: bankAccount,
        nome_completo: respName,
        cpf: respCpf,
        cargo: respRole,
        min_value: minValue,
        max_value: maxValue,
        sectors: selectedSectors,
      };

      const { error } = await supabase
        .from("company_profiles")
        .upsert(payload, { onConflict: "tenant_id" });

      if (error) {
        throw error;
      }

      setSuccessMsg("Dados da empresa guardados com sucesso!");
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message ?? "Erro ao salvar dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Nav />
      <main className="flex-1 overflow-y-auto px-8 py-8 lg:px-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Configurações da empresa</h1>
              <p className="text-sm text-slate-500">
                Cadastro, dados bancários, responsável legal e interesses comerciais para a IA.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 self-start">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ambiente Operacional
            </div>
          </header>

          {successMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Grid Superior: Dados da Empresa & Dados Bancários */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dados da empresa */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Dados da empresa</h3>
                    <p className="text-xs text-slate-500">Informações de identificação da empresa.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Razão social *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Nome registrado da empresa"
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dados bancários */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Dados bancários</h3>
                    <p className="text-xs text-slate-500">Informações bancárias utilizadas nas propostas.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Banco
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Nome do banco"
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Agência
                    </label>
                    <input
                      type="text"
                      value={bankAgency}
                      onChange={(e) => setBankAgency(e.target.value)}
                      placeholder="Agência"
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Conta
                  </label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Número da conta"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Responsável legal */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Responsável legal</h3>
                  <p className="text-xs text-slate-500">Dados da pessoa responsável pela empresa.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={respName}
                    onChange={(e) => setRespName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={respCpf}
                    onChange={(e) => setRespCpf(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={respRole}
                    onChange={(e) => setRespRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Interesses da empresa (Com Ramos/Setores clicáveis) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900">Interesses da empresa</h3>
                <p className="text-xs text-slate-500">
                  Clique nos setores e defina faixas de valores para a IA priorizar oportunidades.
                </p>
              </div>

              {/* Ramos / Setores Clicáveis */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Ramos / Setores (Clique para selecionar)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SECTOR_OPTIONS.map((sector) => {
                    const isSelected = selectedSectors.includes(sector);
                    return (
                      <button
                        type="button"
                        key={sector}
                        onClick={() => toggleSector(sector)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 border ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-105"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80"
                        }`}
                      >
                        {sector} {isSelected && " ✓"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Faixa de Valor do Edital (Mínimo e Máximo) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Valor mínimo do edital (R$)
                  </label>
                  <input
                    type="text"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Valor máximo do edital (R$)
                  </label>
                  <input
                    type="text"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
              >
                {loading ? "A guardar..." : "Guardar alterações"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}