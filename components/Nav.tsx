"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotificationsBell from "@/components/NotificationsBell";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => pathname === path;

  const linkClass = (path: string) => `
    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
    ${collapsed ? "justify-center px-0" : ""}
    ${isActive(path) 
      ? "bg-blue-600 text-white font-semibold shadow-sm" 
      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}
  `;

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Erro ao sair da conta:", err);
      router.push("/login");
    }
  };

  return (
    <aside className={`sticky top-0 h-screen bg-slate-950 border-r border-slate-800/85 flex flex-col select-none shrink-0 text-slate-100 transition-all duration-300 ${collapsed ? "w-20" : "w-64"} z-40`}>
      {/* Topo: Logo, Título, Sino de Notificações e Botão de Recolher/Expandir */}
      <div className={`p-4 border-b border-slate-800/80 flex items-center ${collapsed ? "flex-col gap-3 justify-center" : "justify-between gap-2"}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-blue-600 text-white font-bold p-2.5 rounded-xl shadow-md flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
            </svg>
          </div>
          {!collapsed && (
            <div className="truncate">
              <h1 className="font-bold text-slate-100 text-base leading-tight truncate">BidMaster AI</h1>
              <p className="text-[11px] text-slate-400 font-medium truncate">Gestão de Licitações</p>
            </div>
          )}
        </div>

        {/* Ações do Topo: Sino de Notificações + Botão de Collapse */}
        <div className="flex items-center gap-1">
          <NotificationsBell />

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Links de Navegação */}
      <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Menu Principal
          </p>
        )}
        
        <Link href="/" title="Visão Geral" className={linkClass("/")}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          {!collapsed && <span className="truncate">Visão Geral</span>}
        </Link>

        <Link href="/editais" title="Editais & Kanban" className={linkClass("/editais")}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          {!collapsed && <span className="truncate">Editais & Kanban</span>}
        </Link>

        <Link href="/clientes" title="Clientes & Órgãos" className={linkClass("/clientes")}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          {!collapsed && <span className="truncate">Clientes & Órgãos</span>}
        </Link>

        <Link href="/catalogo" title="Catálogo" className={linkClass("/catalogo")}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          {!collapsed && <span className="truncate">Catálogo</span>}
        </Link>

        {!collapsed && (
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2">
            Conta
          </p>
        )}

        <Link href="/perfil" title="Empresa" className={linkClass("/perfil")}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
          </svg>
          {!collapsed && <span className="truncate">Empresa</span>}
        </Link>

        <Link href="/configuracoes" title="Configurações Pessoais" className={linkClass("/configuracoes")}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {!collapsed && <span className="truncate">Configurações Pessoais</span>}
        </Link>
      </div>

      {/* Botão Sair da Conta */}
      <div className="p-3 border-t border-slate-800/80">
        <button 
          onClick={handleSignOut} 
          title="Sair da conta"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${collapsed ? "justify-center px-0" : ""}`}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span className="truncate">Sair da conta</span>}
        </button>
      </div>
    </aside>
  );
}