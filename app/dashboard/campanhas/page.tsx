"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CampaignTable } from "@/components/dashboard/CampaignTable";
import { CreateCampaignForm } from "@/components/dashboard/CreateCampaignForm";
import type { AdsCampaign } from "@/lib/meta-api";

interface CampaignsApiResponse {
  campaigns?: AdsCampaign[];
  error?: string;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<AdsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campaigns`, { cache: "no-store" });
      const data = (await response.json()) as CampaignsApiResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Nao foi possivel carregar campanhas.");
      }
      setCampaigns(data.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  async function handleToggle(campaignId: string, active: boolean) {
    setLoadingId(campaignId);
    try {
      const response = await fetch(`${BASE_PATH}/api/campaigns`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, status: active ? "PAUSED" : "ACTIVE" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao atualizar status.");
      }
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar campanha.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Gestao de anuncios</p>
          <h1 className="text-2xl font-bold text-white">Campanhas Meta Ads</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-3 py-2 text-sm">
            Voltar
          </Link>
          <button
            onClick={() => void loadCampaigns()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-soft"
            type="button"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? <p className="text-sm text-muted">Carregando campanhas...</p> : null}
      {error ? <p className="rounded-lg bg-rose-900/20 p-3 text-sm text-rose-300">{error}</p> : null}

      <CampaignTable campaigns={campaigns} onToggle={handleToggle} loadingId={loadingId} />
      <CreateCampaignForm onCreated={loadCampaigns} />
    </main>
  );
}
