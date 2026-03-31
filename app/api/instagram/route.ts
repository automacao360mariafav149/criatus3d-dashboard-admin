import { NextResponse } from "next/server";
import { getInstagramOverview, getInstagramMedia, getInstagramStories } from "@/lib/meta-api";

export async function GET() {
  try {
    const [overview, topPosts, stories] = await Promise.all([
      getInstagramOverview(),
      getInstagramMedia(),
      getInstagramStories(),
    ]);

    return NextResponse.json({ overview, topPosts, stories });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar os dados do Instagram agora.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
