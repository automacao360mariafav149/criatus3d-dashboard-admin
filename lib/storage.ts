import fs from "fs/promises";
import path from "path";

// In Docker the app runs at /app — data volume mounted at /app/data
// In local dev falls back to <project-root>/data
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  category: "produtos" | "publico" | "campanhas" | "conteudo" | "insights" | "geral";
  content: string;
  date: string;
}

export interface Memory {
  lastUpdated: string;
  entries: MemoryEntry[];
}

export async function readMemory(): Promise<Memory> {
  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf-8");
    return JSON.parse(raw) as Memory;
  } catch {
    return { lastUpdated: new Date().toISOString(), entries: [] };
  }
}

export async function addMemoryEntry(
  entry: Omit<MemoryEntry, "id" | "date">,
): Promise<Memory> {
  const memory = await readMemory();
  const newEntry: MemoryEntry = {
    ...entry,
    id: `mem_${Date.now()}`,
    date: new Date().toISOString().split("T")[0],
  };
  memory.entries.push(newEntry);
  memory.lastUpdated = new Date().toISOString();
  await ensureDir(DATA_DIR);
  await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf-8");
  return memory;
}

export async function deleteMemoryEntry(id: string): Promise<void> {
  const memory = await readMemory();
  memory.entries = memory.entries.filter((e) => e.id !== id);
  memory.lastUpdated = new Date().toISOString();
  await ensureDir(DATA_DIR);
  await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf-8");
}

/** Formats memory as readable text to inject into the agent system prompt */
export function formatMemoryForPrompt(memory: Memory): string {
  if (!memory.entries.length) return "";

  const categories: Record<string, MemoryEntry[]> = {};
  for (const entry of memory.entries) {
    if (!categories[entry.category]) categories[entry.category] = [];
    categories[entry.category].push(entry);
  }

  const LABELS: Record<string, string> = {
    produtos: "Produtos",
    publico: "Público-alvo",
    campanhas: "Campanhas",
    conteudo: "Conteúdo",
    insights: "Insights",
    geral: "Geral",
  };

  const lines = ["## O que você já sabe sobre a Criatus 3D (memória acumulada):\n"];
  for (const [cat, entries] of Object.entries(categories)) {
    lines.push(`### ${LABELS[cat] ?? cat}:`);
    for (const e of entries) {
      lines.push(`- ${e.content} (${e.date})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  text: string;
  tools?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  toolsUsed: string[];
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await ensureDir(CONVERSATIONS_DIR);
  const file = path.join(CONVERSATIONS_DIR, `${conv.id}.json`);
  await fs.writeFile(file, JSON.stringify(conv, null, 2), "utf-8");
}

export async function listConversations(): Promise<Conversation[]> {
  try {
    await ensureDir(CONVERSATIONS_DIR);
    const files = await fs.readdir(CONVERSATIONS_DIR);
    const convs = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await fs.readFile(path.join(CONVERSATIONS_DIR, f), "utf-8");
          return JSON.parse(raw) as Conversation;
        }),
    );
    return convs.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  } catch {
    return [];
  }
}

export async function getConversation(id: string): Promise<Conversation | null> {
  try {
    const file = path.join(CONVERSATIONS_DIR, `${id}.json`);
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

export function generateSessionTitle(firstUserMessage: string): string {
  const clean = firstUserMessage.trim().replace(/\s+/g, " ");
  return clean.length > 60 ? clean.slice(0, 57) + "..." : clean;
}
