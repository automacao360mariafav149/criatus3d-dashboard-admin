"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface ToolEvent {
  name: string;
  label: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  tools?: ToolEvent[];
}

interface AgentConfig {
  accounts: string[];
  apifyConfigured: boolean;
}

const QUICK_PROMPTS = [
  "Como está o desempenho do meu Instagram nos últimos 30 dias?",
  "Analise minhas campanhas e sugira otimizações",
  "Pesquise as contas de referência e sugira 5 ideias de posts",
  "Crie um calendário de conteúdo para os próximos 7 dias",
  "Quais datas comemorativas devo explorar nos próximos 2 meses?",
  "Sugira uma campanha completa para o Dia das Mães",
  "Quais são as tendências de impressão 3D no Brasil agora?",
  "Compare meu desempenho com as contas de referência",
];

const TOOL_ICONS: Record<string, string> = {
  get_instagram_data: "📊",
  get_campaigns_data: "📣",
  research_instagram_accounts: "🔎",
  web_search: "🌐",
};

const TOOL_LABELS_PT: Record<string, string> = {
  get_instagram_data: "Dados do Instagram",
  get_campaigns_data: "Campanhas Meta Ads",
  research_instagram_accounts: "Pesquisa de contas",
  web_search: "Pesquisa web",
};

function renderText(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (/^###\s/.test(line)) {
      return (
        <p key={i} className="mt-4 mb-1 text-sm font-bold text-white">
          {line.replace(/^###\s/, "")}
        </p>
      );
    }
    if (/^##\s/.test(line)) {
      return (
        <p key={i} className="mt-5 mb-1 text-base font-bold text-white">
          {line.replace(/^##\s/, "")}
        </p>
      );
    }
    if (/^#\s/.test(line)) {
      return (
        <p key={i} className="mt-5 mb-2 text-lg font-bold text-white">
          {line.replace(/^#\s/, "")}
        </p>
      );
    }
    if (/^[-*]\s/.test(line)) {
      return (
        <div key={i} className="flex gap-2">
          <span className="mt-0.5 text-accent shrink-0">•</span>
          <span>{renderInline(line.replace(/^[-*]\s/, ""))}</span>
        </div>
      );
    }
    const numMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2">
          <span className="mt-0.5 text-accent shrink-0 font-semibold">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i}>{renderInline(line)}</p>;
  });
}

function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part))
      return <code key={i} className="rounded bg-white/10 px-1 py-0.5 text-xs font-mono text-accent">{part.slice(1, -1)}</code>;
    return part;
  });
}

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolEvent[]>([]);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [newAccount, setNewAccount] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/api/agente`)
      .then((r) => r.json())
      .then((d) => setConfig(d as AgentConfig))
      .catch(() => null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTools, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", text: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setActiveTools([]);

    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.text }));
    const collectedTools: ToolEvent[] = [];
    let responseText = "";

    try {
      const res = await fetch(`${BASE_PATH}/api/agente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.body) throw new Error("Sem resposta do servidor.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: { type: string; text?: string; name?: string; label?: string; message?: string };
          try { event = JSON.parse(line.slice(6)) as typeof event; } catch { continue; }

          if (event.type === "tool") {
            const tool: ToolEvent = { name: event.name ?? "", label: event.label ?? "" };
            collectedTools.push(tool);
            setActiveTools([...collectedTools]);
          } else if (event.type === "text") {
            responseText = event.text ?? "";
          } else if (event.type === "error") {
            responseText = `Erro: ${event.message ?? "Erro desconhecido"}`;
          }
        }
      }
    } catch (err) {
      responseText = err instanceof Error ? `Erro: ${err.message}` : "Erro inesperado.";
    }

    setMessages((prev) => [...prev, { role: "assistant", text: responseText, tools: collectedTools }]);
    setActiveTools([]);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function buildResearchPrompt() {
    if (!config?.accounts.length) return "Pesquise contas de impressão 3D no Brasil e sugira 5 ideias de posts";
    return `Pesquise as contas ${config.accounts.map((a) => "@" + a).join(", ")} e sugira 5 ideias de posts para a Criatus 3D com base no que está funcionando para elas`;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-0 px-4 py-6 md:px-6">
      {/* Header */}
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Criatus 3D</p>
          <h1 className="text-2xl font-bold text-white">Agente de Marketing</h1>
          <p className="mt-1 text-sm text-muted">
            Analisa dados reais, pesquisa concorrentes e sugere estratégias
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white transition"
          >
            ⚙ Contas
          </button>
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white transition">
            Voltar
          </Link>
        </div>
      </header>

      {/* Config panel — reference accounts */}
      {showConfig && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Contas de Referência / Concorrentes</h2>

          {/* Apify status */}
          <div className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${config?.apifyConfigured ? "bg-emerald-500/10 text-emerald-300" : "bg-yellow-500/10 text-yellow-300"}`}>
            {config?.apifyConfigured ? "✓ Apify configurado — pesquisa de contas ativa" : "⚠ Adicione APIFY_TOKEN no EasyPanel para ativar pesquisa de contas"}
          </div>

          {/* Account list */}
          {config?.accounts.length ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {config.accounts.map((acc) => (
                <span key={acc} className="flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
                  @{acc}
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted">Nenhuma conta configurada. Adicione REFERENCE_ACCOUNTS no EasyPanel.</p>
          )}

          <div className="flex gap-2">
            <input
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
              placeholder="@conta para pesquisar agora"
              className="flex-1 rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-sm text-white placeholder-muted outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!newAccount.trim()) return;
                const handle = newAccount.trim().replace(/^@/, "");
                void sendMessage(`Pesquise o perfil @${handle} e sugira ideias de posts para a Criatus 3D`);
                setNewAccount("");
                setShowConfig(false);
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-soft transition"
            >
              Pesquisar
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Para contas permanentes: adicione <code className="text-accent">REFERENCE_ACCOUNTS=conta1,conta2,conta3</code> no EasyPanel → Ambiente
          </p>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-1 flex-col gap-4">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-4xl">
              🤖
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Como posso ajudar hoje?</h2>
              <p className="mt-1 text-sm text-muted max-w-md">
                Analiso seu Instagram e Meta Ads com dados reais, pesquiso concorrentes via Apify e busco tendências na web.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 w-full max-w-2xl">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    const text = prompt.includes("referência") ? buildResearchPrompt() : prompt;
                    void sendMessage(text);
                  }}
                  className="rounded-xl border border-white/10 bg-card p-3 text-left text-sm text-muted hover:border-accent/50 hover:text-white transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${msg.role === "user" ? "bg-accent text-white" : "bg-white/10"}`}>
                  {msg.role === "user" ? "V" : "🤖"}
                </div>
                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === "user" ? "items-end" : ""}`}>
                  {msg.role === "assistant" && msg.tools && msg.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {msg.tools.map((t, ti) => (
                        <span key={ti} className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          {TOOL_ICONS[t.name] ?? "🔧"} {TOOL_LABELS_PT[t.name] ?? t.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-accent text-white rounded-tr-sm" : "bg-card border border-white/10 text-muted rounded-tl-sm"}`}>
                    {msg.role === "assistant"
                      ? <div className="flex flex-col gap-0.5">{renderText(msg.text)}</div>
                      : msg.text}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm">🤖</div>
                <div className="flex flex-col gap-2 max-w-[85%]">
                  {activeTools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {activeTools.map((t, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent animate-pulse">
                          {TOOL_ICONS[t.name] ?? "🔧"} {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl rounded-tl-sm bg-card border border-white/10 px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 mt-4 rounded-2xl border border-white/10 bg-card p-3">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Pergunte sobre Instagram, campanhas, concorrentes, tendências..."
          className="w-full resize-none bg-transparent text-sm text-white placeholder-muted outline-none disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted">Enter para enviar · Shift+Enter para nova linha</p>
          <button
            type="button"
            disabled={loading || !input.trim()}
            onClick={() => void sendMessage(input)}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-soft disabled:opacity-40 transition"
          >
            {loading ? "Pensando..." : "Enviar"}
          </button>
        </div>
      </div>
    </main>
  );
}
