"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import { SECTOR_OPTIONS } from "@/lib/sectors";

export default function CompanySettingsPage() {
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

  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Lógica de salvamento no Supabase (ajuste conforme sua tabela tenants)
      setSuccessMsg("Dados da empresa salvos com sucesso!");
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
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Configurações da Empresa</h1>
            <p className="text-sm text-slate-500">
              Gerencie o cadastro, dados bancários, responsável legal e interesses comerciais para a IA.
            </p>
          </header>

          {successMsg && <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{successMsg}</div>}
          {errorMsg && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Dados da empresa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Razão social *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nome registrado da empresa"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dados Bancários */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Dados bancários</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Banco</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Nome do banco"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Agência</label>
                  <input
                    type="text"
                    value={bankAgency}
                    onChange={(e) => setBankAgency(e.target.value)}
                    placeholder="Número da agência"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Conta</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Número da conta"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Responsável Legal */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Responsável legal</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
                  <input
                    type="text"
                    value={respName}
                    onChange={(e) => setRespName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={respCpf}
                    onChange={(e) => setRespCpf(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={respRole}
                    onChange={(e) => setRespRole(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Interesses da Empresa (SEM o botão de sugestão da IA) */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Interesses da empresa</h3>
                <p className="text-sm text-slate-500">
                  Detalhe setores, regiões e modalidades para a IA priorizar oportunidades.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ramos / Setores</label>
                <div className="flex flex-wrap gap-2">
                  {SECTOR_OPTIONS.map((sector) => (
                    <span 
                      key={sector} 
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full text-xs font-medium cursor-pointer transition-colors border border-slate-200"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}