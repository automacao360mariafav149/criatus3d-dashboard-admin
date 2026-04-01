"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  toolsUsed: string[];
  messageCount: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  text: string;
  tools?: string[];
}

interface Conversation extends ConversationSummary {
  messages: ConversationMessage[];
}

interface MemoryEntry {
  id: string;
  category: string;
  content: string;
  date: string;
}

interface Memory {
  lastUpdated: string;
  entries: MemoryEntry[];
}

const CATEGORY_LABELS: Record<string, string> = {
  produtos: "Produtos", publico: "Público-alvo", campanhas: "Campanhas",
  conteudo: "Conteúdo", insights: "Insights", geral: "Geral",
};

const CATEGORY_COLORS: Record<string, string> = {
  produtos: "bg-blue-500/20 text-blue-300",
  publico: "bg-purple-500/20 text-purple-300",
  campanhas: "bg-orange-500/20 text-orange-300",
  conteudo: "bg-emerald-500/20 text-emerald-300",
  insights: "bg-yellow-500/20 text-yellow-300",
  geral: "bg-white/10 text-muted",
};

const TOOL_ICONS: Record<string, string> = {
  get_instagram_data: "📊", get_campaigns_data: "📣",
  research_instagram_accounts: "🔎", web_search: "🌐", save_memory: "🧠",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function renderText(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (/^###?\s/.test(line)) return <p key={i} className="mt-2 mb-0.5 font-semibold text-white text-sm">{line.replace(/^###?\s/, "")}</p>;
    if (/^[-*]\s/.test(line)) return <div key={i} className="flex gap-1.5"><span className="text-accent shrink-0">•</span><span>{line.replace(/^[-*]\s/, "")}</span></div>;
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    return <p key={i}>{line}</p>;
  });
}

export default function HistoricoPage() {
  const [tab, setTab] = useState<"conversas" | "memoria">("conversas");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState({ category: "geral", content: "" });
  const [savingMemory, setSavingMemory] = useState(false);

  useEffect(() => {
    fetch(`${BASE_PATH}/api/historico`)
      .then((r) => r.json())
      .then((d) => setConversations(d as ConversationSummary[]))
      .catch(() => null)
      .finally(() => setLoadingConvs(false));
  }, []);

  useEffect(() => {
    if (tab !== "memoria") return;
    setLoadingMemory(true);
    fetch(`${BASE_PATH}/api/memoria`)
      .then((r) => r.json())
      .then((d) => setMemory(d as Memory))
      .catch(() => null)
      .finally(() => setLoadingMemory(false));
  }, [tab]);

  async function loadConversation(id: string) {
    const res = await fetch(`${BASE_PATH}/api/historico?id=${id}`);
    const data = (await res.json()) as Conversation;
    setSelectedConv(data);
  }

  async function deleteMemoryEntry(id: string) {
    setDeletingId(id);
    await fetch(`${BASE_PATH}/api/memoria`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMemory((m) => m ? { ...m, entries: m.entries.filter((e) => e.id !== id) } : m);
    setDeletingId(null);
  }

  async function addMemoryEntry() {
    if (!newMemory.content.trim()) return;
    setSavingMemory(true);
    const res = await fetch(`${BASE_PATH}/api/memoria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMemory),
    });
    const updated = (await res.json()) as Memory;
    setMemory(updated);
    setNewMemory((p) => ({ ...p, content: "" }));
    setSavingMemory(false);
  }

  // Group memory by category
  const memoryByCategory = memory?.entries.reduce<Record<string, MemoryEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {}) ?? {};

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Criatus 3D</p>
          <h1 className="text-2xl font-bold text-white">Histórico & Memória</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/agente" className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition">
            🤖 Agente
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white transition">
            Voltar
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-card p-1 w-fit">
        {(["conversas", "memoria"] as const).map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setSelectedConv(null); }}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t ? "bg-accent text-white" : "text-muted hover:text-white"}`}>
            {t === "conversas" ? "📋 Conversas" : "🧠 Memória"}
          </button>
        ))}
      </div>

      {/* ── Conversas tab ── */}
      {tab === "conversas" && (
        <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
          {/* List */}
          <div className="flex flex-col gap-2">
            {loadingConvs && <p className="text-sm text-muted">Carregando...</p>}
            {!loadingConvs && !conversations.length && (
              <div className="rounded-2xl border border-white/10 bg-card p-5 text-center">
                <p className="text-sm text-muted">Nenhuma conversa salva ainda.</p>
                <Link href="/dashboard/agente" className="mt-2 block text-sm text-accent hover:underline">
                  Iniciar conversa com o agente →
                </Link>
              </div>
            )}
            {conversations.map((conv) => (
              <button key={conv.id} type="button" onClick={() => void loadConversation(conv.id)}
                className={`rounded-xl border p-3 text-left transition ${selectedConv?.id === conv.id ? "border-accent bg-accent/10" : "border-white/10 bg-card hover:border-white/20"}`}>
                <p className="text-sm font-medium text-white line-clamp-2">{conv.title}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(conv.updatedAt)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {conv.toolsUsed.slice(0, 3).map((t) => (
                    <span key={t} className="text-xs">{TOOL_ICONS[t] ?? "🔧"}</span>
                  ))}
                  <span className="text-xs text-muted">{conv.messageCount} mensagens</span>
                </div>
              </button>
            ))}
          </div>

          {/* Conversation detail */}
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            {!selectedConv ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted">Selecione uma conversa para visualizar</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">{selectedConv.title}</h2>
                  <p className="text-xs text-muted shrink-0">{formatDate(selectedConv.updatedAt)}</p>
                </div>
                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
                  {selectedConv.messages.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${msg.role === "user" ? "bg-accent text-white" : "bg-white/10"}`}>
                        {msg.role === "user" ? "V" : "🤖"}
                      </div>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === "user" ? "bg-accent text-white" : "bg-white/5 text-muted border border-white/10"}`}>
                        {msg.tools && msg.tools.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap gap-1">
                            {msg.tools.map((t, ti) => (
                              <span key={ti} className="text-xs opacity-70">{TOOL_ICONS[t] ?? "🔧"}</span>
                            ))}
                          </div>
                        )}
                        {msg.role === "assistant"
                          ? <div className="flex flex-col gap-0.5 text-xs">{renderText(msg.text)}</div>
                          : <span className="text-sm">{msg.text}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Memória tab ── */}
      {tab === "memoria" && (
        <div className="flex flex-col gap-5">
          {/* Add memory manually */}
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">Adicionar à memória manualmente</h2>
            <div className="flex gap-2 flex-wrap">
              <select value={newMemory.category} onChange={(e) => setNewMemory((p) => ({ ...p, category: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white">
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input value={newMemory.content} onChange={(e) => setNewMemory((p) => ({ ...p, content: e.target.value }))}
                placeholder="Ex: Chaveiro de gato é o produto mais vendido"
                className="flex-1 min-w-[200px] rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder-muted outline-none" />
              <button type="button" disabled={savingMemory || !newMemory.content.trim()} onClick={() => void addMemoryEntry()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-soft disabled:opacity-40 transition">
                {savingMemory ? "Salvando..." : "Salvar"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">O agente usa esta memória automaticamente em todas as conversas.</p>
          </div>

          {/* Memory entries */}
          {loadingMemory && <p className="text-sm text-muted">Carregando memória...</p>}

          {!loadingMemory && !memory?.entries.length && (
            <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
              <p className="text-4xl mb-3">🧠</p>
              <p className="text-sm font-medium text-white">Memória vazia</p>
              <p className="mt-1 text-sm text-muted">O agente vai acumulando memória automaticamente conforme você conversa com ele.</p>
            </div>
          )}

          {Object.entries(memoryByCategory).map(([cat, entries]) => (
            <div key={cat} className="rounded-2xl border border-white/10 bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <span className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLORS[cat] ?? "bg-white/10 text-muted"}`}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className="text-muted font-normal">{entries.length} {entries.length === 1 ? "item" : "itens"}</span>
              </h2>
              <div className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <p className="flex-1 text-sm text-muted">{entry.content}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted">{entry.date}</span>
                      <button type="button" disabled={deletingId === entry.id}
                        onClick={() => void deleteMemoryEntry(entry.id)}
                        className="text-xs text-muted hover:text-rose-300 transition disabled:opacity-40">
                        {deletingId === entry.id ? "..." : "✕"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
