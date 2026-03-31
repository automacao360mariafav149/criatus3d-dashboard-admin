import { NextRequest, NextResponse } from "next/server";
import { createCampaign, listAdsCampaigns, toggleCampaignStatus } from "@/lib/meta-api";

export async function GET() {
  try {
    const campaigns = await listAdsCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel carregar as campanhas agora.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignId = await createCampaign({
      name: String(body.name ?? ""),
      objective: body.objective === "FOLLOWERS" ? "FOLLOWERS" : "BRAND_AWARENESS",
      dailyBudget: Number(body.dailyBudget ?? 0),
      startDate: String(body.startDate ?? ""),
      endDate: String(body.endDate ?? ""),
      cities: Array.isArray(body.cities) ? body.cities.map(String) : [],
      interests: Array.isArray(body.interests) ? body.interests.map(String) : [],
    });

    return NextResponse.json({
      message: "Campanha criada com sucesso em modo pausado para validacao final.",
      campaignId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel criar a campanha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignId = String(body.campaignId ?? "");
    const status = body.status === "ACTIVE" ? "ACTIVE" : "PAUSED";

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campanha invalida para atualizar status." },
        { status: 400 },
      );
    }

    await toggleCampaignStatus(campaignId, status);
    return NextResponse.json({ message: "Status atualizado com sucesso." });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o status da campanha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
