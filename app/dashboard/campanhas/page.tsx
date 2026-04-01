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

const PERIOD_OPTIONS = [
  { label: "7 dias", value: "last_7d" },
  { label: "14 dias", value: "last_14d" },
  { label: "30 dias", value: "last_30d" },
  { label: "90 dias", value: "last_90d" },
  { label: "Tudo", value: "lifetime" },
];

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<AdsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [period, setPeriod] = useState("last_30d");

  const loadCampaigns = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/campaigns?period=${p}`, { cache: "no-store" });
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
    void loadCampaigns(period);
  }, [loadCampaigns, period]);

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
      await loadCampaigns(period);
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
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                period === opt.value
                  ? "border-accent bg-accent text-white"
                  : "border-white/20 text-muted hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white">
            Voltar
          </Link>
          <button
            onClick={() => void loadCampaigns(period)}
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
      <CreateCampaignForm onCreated={() => loadCampaigns(period)} />
    </main>
  );
}
