import { NextResponse } from "next/server";
import { getInstagramOverview, getInstagramMedia, getInstagramStories } from "@/lib/meta-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(30, Math.max(7, parseInt(searchParams.get("days") ?? "30", 10)));
  try {
    const [media, stories] = await Promise.all([getInstagramMedia(days), getInstagramStories()]);
    const overview = await getInstagramOverview(days, media);
    return NextResponse.json({ overview, topPosts: media, stories, days });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar os dados do Instagram agora.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
