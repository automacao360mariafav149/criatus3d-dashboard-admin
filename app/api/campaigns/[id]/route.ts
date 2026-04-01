import { NextResponse } from "next/server";
import { getCampaignDetails } from "@/lib/meta-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const details = await getCampaignDetails(id);
    return NextResponse.json(details);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar campanha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
