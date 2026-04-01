import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import {
  getInstagramMedia,
  getInstagramOverview,
  getInstagramStories,
  listAdsCampaigns,
} from "@/lib/meta-api";
import {
  addMemoryEntry,
  formatMemoryForPrompt,
  generateSessionTitle,
  readMemory,
  saveConversation,
} from "@/lib/storage";
import type { ConversationMessage } from "@/lib/storage";

const BASE_SYSTEM_PROMPT = `Você é o Agente de Marketing Digital da Criatus 3D — uma empresa brasileira de impressão 3D localizada em Contagem e Belo Horizonte, Minas Gerais.

A empresa produz e vende:
- Chaveiros personalizados em 3D
- Presentes personalizados para datas comemorativas
- Decoração impressa em 3D
- Produtos customizados para empresas e pessoas físicas

Público-alvo principal: região metropolitana de BH, pessoas interessadas em presentes, decoração, pets e personalização.

Você tem acesso a cinco ferramentas:
1. get_instagram_data — busca métricas reais do Instagram da Criatus 3D
2. get_campaigns_data — busca campanhas reais do Meta Ads com performance e gastos
3. research_instagram_accounts — pesquisa posts reais de contas de referência/concorrentes via Apify
4. web_search — pesquisa na internet: tendências, datas comemorativas, mercado
5. save_memory — salva um insight importante na sua memória permanente

REGRAS:
- Antes de analisar desempenho ou sugerir estratégias, USE AS FERRAMENTAS para ter dados reais
- Para inspiração de conteúdo, use research_instagram_accounts para analisar contas relevantes
- Ao aprender algo relevante sobre produtos, público ou estratégias, use save_memory para registrar
- Seja específico e acionável — nunca dê conselhos genéricos
- Ao sugerir posts: defina tema, formato (Reels/Carrossel/Story/Feed), legenda completa, hashtags e horário ideal
- Ao sugerir campanhas: defina objetivo, orçamento diário, público-alvo, cidades, período e ideia de criativo
- Responda sempre em português do Brasil`;

interface ToolInput {
  days?: number;
  period?: string;
  usernames?: string[];
  posts_per_account?: number;
  category?: string;
  content?: string;
}

// ─── Apify ────────────────────────────────────────────────────────────────────

interface ApifyRun {
  data: { id: string; status: string; defaultDatasetId: string };
}

async function scrapeInstagramAccounts(usernames: string[], postsPerAccount = 10): Promise<unknown> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { error: "APIFY_TOKEN não configurado." };

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames, resultsLimit: postsPerAccount, proxy: { useApifyProxy: true } }),
    },
  );
  if (!startRes.ok) return { error: `Erro ao iniciar Apify: ${await startRes.text()}` };

  const runData = (await startRes.json()) as ApifyRun;
  const runId = runData.data.id;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const statusData = (await statusRes.json()) as ApifyRun;
    const status = statusData.data.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData.data.defaultDatasetId;
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=100`,
      );
      const items = (await itemsRes.json()) as Record<string, unknown>[];
      return items.map((p) => ({
        username: p.ownerUsername ?? p.username,
        type: p.type,
        caption: typeof p.caption === "string" ? p.caption.slice(0, 300) : "",
        likes: p.likesCount,
        comments: p.commentsCount,
        timestamp: p.timestamp,
        hashtags: p.hashtags,
        url: p.url,
        videoViewCount: p.videoViewCount,
      }));
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      return { error: `Apify falhou: ${status}` };
    }
  }
  return { error: "Timeout: Apify demorou mais de 90 segundos." };
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeCustomTool(name: string, input: ToolInput): Promise<unknown> {
  if (name === "get_instagram_data") {
    const days = input.days ?? 30;
    const media = await getInstagramMedia(days);
    const [overview, stories] = await Promise.all([
      getInstagramOverview(days, media),
      getInstagramStories(),
    ]);
    return { overview, recentPosts: media, stories };
  }

  if (name === "get_campaigns_data") {
    const period = input.period ?? "last_30d";
    const campaigns = await listAdsCampaigns(period);
    return { campaigns, period };
  }

  if (name === "research_instagram_accounts") {
    const defaultAccounts = (process.env.REFERENCE_ACCOUNTS ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^@/, ""))
      .filter(Boolean);
    const usernames =
      input.usernames?.length
        ? input.usernames.map((u) => u.replace(/^@/, ""))
        : defaultAccounts;
    if (!usernames.length) return { error: "Nenhuma conta fornecida." };
    return scrapeInstagramAccounts(usernames, input.posts_per_account ?? 10);
  }

  if (name === "save_memory") {
    const allowed = ["produtos", "publico", "campanhas", "conteudo", "insights", "geral"];
    const category = allowed.includes(input.category ?? "") ? input.category! : "geral";
    if (!input.content?.trim()) return { error: "content é obrigatório." };
    await addMemoryEntry({ category: category as "geral", content: input.content.trim() });
    return { ok: true, message: "Salvo na memória permanente." };
  }

  return { error: "Ferramenta não encontrada" };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  get_instagram_data: "Buscando dados do Instagram...",
  get_campaigns_data: "Buscando campanhas Meta Ads...",
  research_instagram_accounts: "Pesquisando contas via Apify...",
  save_memory: "Salvando na memória...",
  web_search: "Pesquisando na web...",
};

const CUSTOM_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_instagram_data",
    description: "Busca métricas reais do Instagram da Criatus 3D: seguidores, alcance, engajamento, reels, stories, melhores horários e demografias.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Período em dias: 7, 14 ou 30", enum: [7, 14, 30] } },
      required: [],
    },
  },
  {
    name: "get_campaigns_data",
    description: "Busca campanhas do Meta Ads: gastos, impressões, cliques, CPM, CPC e status.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", description: "Período", enum: ["last_7d", "last_14d", "last_30d", "last_90d", "lifetime"] },
      },
      required: [],
    },
  },
  {
    name: "research_instagram_accounts",
    description: "Pesquisa posts reais de contas Instagram (concorrentes/referências) via Apify. Retorna posts recentes com curtidas, comentários, legendas e hashtags.",
    input_schema: {
      type: "object",
      properties: {
        usernames: { type: "array", items: { type: "string" }, description: "Lista de usernames sem @" },
        posts_per_account: { type: "number", description: "Posts por conta (padrão 10, máx 30)" },
      },
      required: [],
    },
  },
  {
    name: "save_memory",
    description: "Salva um insight importante na memória permanente do agente. Use quando aprender algo relevante sobre produtos, público, campanhas ou estratégias da Criatus 3D que deve ser lembrado em conversas futuras.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Categoria da memória",
          enum: ["produtos", "publico", "campanhas", "conteudo", "insights", "geral"],
        },
        content: {
          type: "string",
          description: "O insight a ser salvo — seja específico e conciso",
        },
      },
      required: ["category", "content"],
    },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: any[] = [
  ...CUSTOM_TOOLS,
  { type: "web_search_20250305", name: "web_search" },
];

const CUSTOM_TOOL_NAMES = new Set(CUSTOM_TOOLS.map((t) => t.name));

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let body: {
    messages?: Anthropic.MessageParam[];
    sessionId?: string;
    sessionMessages?: ConversationMessage[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const sessionId = body.sessionId ?? `sess_${Date.now()}`;
  const sessionMessages = body.sessionMessages ?? [];

  // Build system prompt with injected memory
  const memory = await readMemory();
  const memorySection = formatMemoryForPrompt(memory);
  const systemPrompt = memorySection
    ? `${BASE_SYSTEM_PROMPT}\n\n${memorySection}`
    : BASE_SYSTEM_PROMPT;

  const encoder = new TextEncoder();
  const allToolsUsed: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const currentMessages: Anthropic.MessageParam[] = [...messages];
        let finalText = "";

        for (let i = 0; i < 10; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await (client.messages.create as any)({
            model: "claude-sonnet-4-6",
            max_tokens: 8096,
            system: systemPrompt,
            tools: ALL_TOOLS,
            messages: currentMessages,
          }) as Anthropic.Message;

          currentMessages.push({ role: "assistant", content: response.content });

          if (response.stop_reason === "tool_use") {
            const customBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock =>
                b.type === "tool_use" && CUSTOM_TOOL_NAMES.has(b.name),
            );

            if (!customBlocks.length) break;

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const toolUse of customBlocks) {
              if (!allToolsUsed.includes(toolUse.name)) allToolsUsed.push(toolUse.name);
              send({ type: "tool", name: toolUse.name, label: TOOL_LABELS[toolUse.name] ?? `Executando ${toolUse.name}...` });
              const result = await executeCustomTool(toolUse.name, toolUse.input as ToolInput);
              toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
            }
            currentMessages.push({ role: "user", content: toolResults });
          } else {
            for (const block of response.content) {
              if (block.type === "text") {
                finalText = block.text;
                send({ type: "text", text: block.text });
              }
            }
            break;
          }
        }

        // Auto-save conversation session
        if (sessionMessages.length > 0 && finalText) {
          const updatedMessages: ConversationMessage[] = [
            ...sessionMessages,
            { role: "assistant", text: finalText, tools: allToolsUsed },
          ];
          const firstUserMsg = updatedMessages.find((m) => m.role === "user");
          await saveConversation({
            id: sessionId,
            title: generateSessionTitle(firstUserMsg?.text ?? "Conversa"),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: updatedMessages,
            toolsUsed: allToolsUsed,
          }).catch(() => null); // never fail the response due to save error
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Erro inesperado." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

// ─── Config endpoint ──────────────────────────────────────────────────────────

export async function GET() {
  const accounts = (process.env.REFERENCE_ACCOUNTS ?? "")
    .split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
  const apifyConfigured = !!process.env.APIFY_TOKEN;
  const memory = await readMemory();
  return Response.json({ accounts, apifyConfigured, memoryEntries: memory.entries.length });
}
