"use client";

import { useState } from "react";
import Link from "next/link";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount] = useState(2); // Exemplo de contagem

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        title="Notificações"
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus:outline-none"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover das Notificações */}
      {open && (
        <>
          {/* Backdrop para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute left-full top-0 z-50 ml-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-slate-900 dark:text-slate-100 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificações</h3>
              <span className="rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {unreadCount} novas
              </span>
            </div>

            <div className="max-h-64 space-y-3 overflow-y-auto">
              <div className="space-y-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Análise de IA concluída
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  O edital &quot;Solução de Software em Nuvem&quot; foi analisado com sucesso.
                </p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Há 10 minutos</span>
              </div>

              <div className="space-y-1 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Alerta de Prazo</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  O edital &quot;Atendimento ao Cidadão&quot; vence em breve.
                </p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Há 2 horas</span>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 text-center">
              <Link
                href="/notificacoes"
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Ver todas as configurações de notificações →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}