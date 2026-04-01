import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `Você é o Agente de Marketing Digital da Criatus 3D — uma empresa brasileira de impressão 3D localizada em Contagem e Belo Horizonte, Minas Gerais.

A empresa produz e vende:
- Chaveiros personalizados em 3D
- Presentes personalizados para datas comemorativas
- Decoração impressa em 3D
- Produtos customizados para empresas e pessoas físicas

Público-alvo principal: região metropolitana de BH, pessoas interessadas em presentes, decoração, pets e personalização.

Você tem acesso a três ferramentas:
1. get_instagram_data — busca métricas reais do Instagram da Criatus 3D
2. get_campaigns_data — busca campanhas reais do Meta Ads com performance e gastos
3. web_search — pesquisa na internet: tendências, concorrentes, datas comemorativas, mercado

REGRAS:
- Antes de analisar desempenho ou sugerir estratégias, USE AS FERRAMENTAS para ter dados reais
- Para perguntas de mercado ou tendências, use web_search para buscar informações atualizadas
- Seja específico e acionável — não dê conselhos genéricos
- Sugira campanhas com: objetivo, orçamento diário, público-alvo, cidades, período e ideia de criativo
- Para conteúdo orgânico: sugira tema, formato (Reels/Carrossel/Story), legenda, hashtags e melhor horário
- Identifique datas comemorativas relevantes para personalização (Dia das Mães, Namorados, Natal, etc.)
- Responda sempre em português do Brasil`;

interface ToolInput {
  days?: number;
  period?: string;
}

async function executeCustomTool(name: string, input: ToolInput, baseUrl: string): Promise<unknown> {
  if (name === "get_instagram_data") {
    const days = input.days ?? 30;
    const res = await fetch(`${baseUrl}/api/instagram?days=${days}`, { cache: "no-store" });
    return res.json();
  }
  if (name === "get_campaigns_data") {
    const period = input.period ?? "last_30d";
    const res = await fetch(`${baseUrl}/api/campaigns?period=${period}`, { cache: "no-store" });
    return res.json();
  }
  return { error: "Ferramenta não encontrada" };
}

const TOOL_LABELS: Record<string, string> = {
  get_instagram_data: "Buscando dados do Instagram...",
  get_campaigns_data: "Buscando campanhas Meta Ads...",
  web_search: "Pesquisando na web...",
};

// Tools: two custom + one Anthropic server-side web search
const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_instagram_data",
    description:
      "Busca métricas reais do Instagram da Criatus 3D: seguidores, alcance, engajamento, reels, stories, melhores horários de postagem e demografias do público.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Período em dias: 7, 14 ou 30",
          enum: [7, 14, 30],
        },
      },
      required: [],
    },
  },
  {
    name: "get_campaigns_data",
    description:
      "Busca dados reais de campanhas do Meta Ads da Criatus 3D: lista de campanhas com gastos, impressões, cliques, CPM, CPC e status.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Período dos dados",
          enum: ["last_7d", "last_14d", "last_30d", "last_90d", "lifetime"],
        },
      },
      required: [],
    },
  },
];

// Web search is a server-side Anthropic tool — cast to any since SDK types may lag behind
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: any[] = [...TOOLS, { type: "web_search_20250305", name: "web_search" }];

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY não configurada no servidor." }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let body: { messages?: Anthropic.MessageParam[] };
  try {
    body = (await request.json()) as { messages?: Anthropic.MessageParam[] };
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const currentMessages: Anthropic.MessageParam[] = [...messages];

        for (let i = 0; i < 8; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await (client.messages.create as any)({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: ALL_TOOLS,
            messages: currentMessages,
          }) as Anthropic.Message;

          currentMessages.push({ role: "assistant", content: response.content });

          if (response.stop_reason === "tool_use") {
            // Only handle custom tools — web_search is server-side and handled by Anthropic
            const customToolUseBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock =>
                b.type === "tool_use" &&
                (b.name === "get_instagram_data" || b.name === "get_campaigns_data"),
            );

            if (customToolUseBlocks.length === 0) {
              // All tool_use blocks are server-side (web_search); should not reach here normally
              // but if it does, break to avoid infinite loop
              break;
            }

            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolUse of customToolUseBlocks) {
              send({
                type: "tool",
                name: toolUse.name,
                label: TOOL_LABELS[toolUse.name] ?? `Executando ${toolUse.name}...`,
              });
              const result = await executeCustomTool(toolUse.name, toolUse.input as ToolInput, baseUrl);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              });
            }

            currentMessages.push({ role: "user", content: toolResults });
          } else {
            // end_turn — send all text blocks
            for (const block of response.content) {
              if (block.type === "text") {
                send({ type: "text", text: block.text });
              }
            }
            break;
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Erro inesperado no agente.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
