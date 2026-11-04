"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import GoNoGo from "@/components/GoNoGo";
import PlanilhaDimensionamento from "@/components/PlanilhaDimensionamento";

type BidDetail = {
  id: string;
  title: string;
  status: string;
  estimated_value: number;
  deadline: string;
  pdf_url?: string;
  client_id?: string;
};

export default function EditalDetailPage() {
  const params = useParams();
  const supabase = createClient();

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [clientName, setClientName] = useState<string>("Cliente não informado");
  const [loading, setLoading] = useState(true);

  const rawId = params?.id;
  const editalId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    async function fetchBidData() {
      if (!editalId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: bidData, error } = await supabase
          .from("bids")
          .select("*")
          .eq("id", editalId)
          .single();

        if (error || !bidData) {
          console.error("Erro ao carregar edital:", error);
          setLoading(false);
          return;
        }

        setBid(bidData as BidDetail);

        if (bidData.client_id) {
          const { data: clientData } = await supabase
            .from("clients")
            .select("name")
            .eq("id", bidData.client_id)
            .single();

          if (clientData?.name) {
            setClientName(clientData.name);
          }
        }
      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchBidData();
  }, [editalId, supabase]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
        <Nav />
        <main className="flex-1 p-8 font-medium text-slate-500 dark:text-slate-400">
          Carregando detalhes do edital...
        </main>
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
        <Nav />
        <main className="flex-1 p-8">
          <p className="font-semibold text-red-600 dark:text-red-400">Edital não encontrado.</p>
          <Link
            href="/editais"
            className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Voltar para a lista
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <Nav />

      <main className="mx-auto max-w-6xl flex-1 space-y-6 overflow-y-auto p-6 sm:p-10">
        {/* Voltar / Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/editais"
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Voltar para editais
          </Link>
          <span className="rounded-lg bg-slate-200 dark:bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Status: {bid.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>

        {/* Informações Principais do Edital */}
        <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {clientName}
          </span>
          <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white">{bid.title}</h1>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
                Valor Estimado
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatBRL(bid.estimated_value)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
                Data Limite / Prazo
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {bid.deadline
                  ? new Date(bid.deadline).toLocaleDateString("pt-BR")
                  : "Data a definir"}
              </p>
            </div>
          </div>
        </div>

        {/* Planilha de Dimensionamento Editável */}
        {editalId && <PlanilhaDimensionamento editalId={editalId} />}

        {/* Go/No-Go */}
        {editalId && (
          <GoNoGo
            bidId={editalId}
            habilitacao={{
              juridica: [],
              fiscal: [],
              tecnica: [],
              economica: [],
            }}
            initialChecklist={[]}
            initialDecision={null}
          />
        )}
      </main>
    </div>
  );
}