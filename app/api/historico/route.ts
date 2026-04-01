import { NextRequest } from "next/server";
import { getConversation, listConversations, saveConversation } from "@/lib/storage";
import type { Conversation } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const conv = await getConversation(id);
    if (!conv) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
    return Response.json(conv);
  }

  const conversations = await listConversations();
  // Return summary (no messages) for list view
  return Response.json(
    conversations.map(({ id, title, createdAt, updatedAt, toolsUsed, messages }) => ({
      id,
      title,
      createdAt,
      updatedAt,
      toolsUsed,
      messageCount: messages.length,
    })),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Conversation>;
    if (!body.id || !body.messages) {
      return Response.json({ error: "id e messages são obrigatórios." }, { status: 400 });
    }
    const conv: Conversation = {
      id: body.id,
      title: body.title ?? "Conversa sem título",
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: body.messages,
      toolsUsed: body.toolsUsed ?? [],
    };
    await saveConversation(conv);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Erro ao salvar conversa." }, { status: 500 });
  }
}
