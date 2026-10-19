"use client";

import { useState } from "react";

type Message = {
  sender: "user" | "ai";
  text: string;
};

type ChatEditalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editalTitle: string;
  documentContext?: string;
};

export default function ChatEditalModal({
  isOpen,
  onClose,
  editalTitle,
  documentContext,
}: ChatEditalModalProps) {
  // Inicializa o estado diretamente com a saudação específica do edital atual
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: `Olá! Sou a assistente de IA do BidMaster. Como posso ajudar com a análise do edital "${editalTitle}"?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat-edital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          editalTitle,
          documentContext: documentContext || "Detalhes do edital fornecidos no cadastro.",
        }),
      });

      const data = await res.json();

      if (res.ok && data.answer) {
        setMessages((prev) => [...prev, { sender: "ai", text: data.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: `⚠️ ${data.error || "Erro ao consultar a IA."}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "⚠️ Falha ao conectar ao serviço de IA." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="flex h-150 w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              IA
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">Assistente de Leitura de Edital</h3>
              <p className="text-xs text-slate-400 truncate max-w-sm">{editalTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  m.sender === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-none bg-white border border-slate-200 px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                <span>Lendo o edital com LangChain...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre este edital (prazos, exigências, valores)..."
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}