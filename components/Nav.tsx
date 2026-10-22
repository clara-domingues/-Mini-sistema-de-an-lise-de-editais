"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link_url?: string;
  created_at: string;
};

export default function Nav() {
  const pathname = usePathname();
  const supabase = createClient();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Carregar notificações da API de Notificações
  useEffect(() => {
    async function fetchNotifications() {
      try {
        setLoading(true);
        const res = await fetch("/api/notificacoes");
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          setNotifications([]);
          return;
        }

        const data = await res.json();
        if (data.success && data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.error("Erro ao carregar notificações:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <aside
      className={`bg-[#0B132B] text-slate-300 flex flex-col justify-between shrink-0 h-screen sticky top-0 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="p-4 space-y-6">
        {/* LOGO & BOTÃO DE RECOLHER */}
        <div className="flex items-center justify-between px-2 pt-2">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-xl font-bold text-lg flex items-center justify-center w-10 h-10 shadow-lg shadow-blue-600/30">
                B
              </div>
              <div>
                <h1 className="font-extrabold text-white tracking-wide text-sm leading-tight">
                  BidMaster AI
                </h1>
                <span className="text-[10px] text-slate-400 font-medium">
                  Gestão de Licitações
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition mx-auto"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <svg
              className={`w-5 h-5 transform transition-transform ${collapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* SINO DE NOTIFICAÇÕES */}
        <div className="relative px-2">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative w-full flex items-center gap-3 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            title="Notificações"
          >
            <div className="relative">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            {!collapsed && <span className="text-xs font-semibold">Notificações</span>}
          </button>

          {/* DROPDOWN DE NOTIFICAÇÕES */}
          {showDropdown && (
            <div className="absolute left-full top-0 ml-3 w-80 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Notificações & Alertas
                </h3>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} pendentes
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {loading ? (
                  <p className="text-xs text-slate-400 p-2 text-center">A carregar alertas...</p>
                ) : notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => void markAsRead(n.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        n.read
                          ? "bg-slate-50 border-slate-100 text-slate-500"
                          : "bg-blue-50/60 border-blue-100 text-slate-800 font-medium"
                      }`}
                    >
                      <p className="font-bold text-slate-900">{n.title}</p>
                      <p className="mt-0.5 text-[11px] leading-tight">{n.message}</p>
                      <span className="mt-1 block text-[9px] text-slate-400">
                        {new Date(n.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 p-4 text-center">
                    Nenhum alerta de prazo no momento.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MENU PRINCIPAL */}
        <nav className="space-y-1 pt-2">
          {!collapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Menu Principal
            </p>
          )}

          {/* LINK DE VISÃO GERAL APONTANDO PARA A ROTA RAIZ '/' */}
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive("/")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title="Visão Geral"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            {!collapsed && <span>Visão Geral</span>}
          </Link>

          <Link
            href="/editais"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive("/editais")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title="Editais & Kanban"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!collapsed && <span>Editais & Kanban</span>}
          </Link>

          <Link
            href="/clientes"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive("/clientes")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title="Clientes & Órgãos"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {!collapsed && <span>Clientes & Órgãos</span>}
          </Link>

          <Link
            href="/catalogo"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive("/catalogo")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title="Catálogo"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {!collapsed && <span>Catálogo</span>}
          </Link>
        </nav>

        {/* SECÇÃO DE CONTA */}
        <div className="space-y-1 pt-4 border-t border-slate-800">
          {!collapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Conta
            </p>
          )}

          <Link
            href="/perfil"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive("/perfil")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title="Empresa"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
            </svg>
            {!collapsed && <span>Empresa</span>}
          </Link>

          <Link
            href="/configuracoes"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              isActive("/configuracoes")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
            title="Configurações Pessoais"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!collapsed && <span>Configurações Pessoais</span>}
          </Link>
        </div>
      </div>
    </aside>
  );
}