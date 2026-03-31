import { NextResponse } from "next/server";
import { getInstagramOverview, getTopInstagramPosts } from "@/lib/meta-api";

export async function GET() {
  try {
    const [overview, topPosts] = await Promise.all([
      getInstagramOverview(),
      getTopInstagramPosts(),
    ]);

    return NextResponse.json({ overview, topPosts });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar os dados do Instagram agora.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
