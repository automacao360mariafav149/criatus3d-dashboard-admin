import { NextRequest } from "next/server";
import { addMemoryEntry, deleteMemoryEntry, readMemory } from "@/lib/storage";

export async function GET() {
  const memory = await readMemory();
  return Response.json(memory);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { category?: string; content?: string };
    if (!body.content?.trim()) {
      return Response.json({ error: "content é obrigatório." }, { status: 400 });
    }
    const allowed = ["produtos", "publico", "campanhas", "conteudo", "insights", "geral"];
    const category = allowed.includes(body.category ?? "") ? body.category! : "geral";
    const memory = await addMemoryEntry({ category: category as "geral", content: body.content.trim() });
    return Response.json(memory);
  } catch {
    return Response.json({ error: "Erro ao salvar memória." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id) return Response.json({ error: "id é obrigatório." }, { status: 400 });
    await deleteMemoryEntry(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Erro ao deletar memória." }, { status: 500 });
  }
}
