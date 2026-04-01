"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TopPosts } from "@/components/dashboard/TopPosts";
import type { InstagramOverview, InstagramPost } from "@/lib/meta-api";

interface InstagramApiResponse {
  overview?: InstagramOverview;
  topPosts?: InstagramPost[];
  error?: string;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<InstagramOverview | null>(null);
  const [topPosts, setTopPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/instagram`, { cache: "no-store" });
      const data = (await response.json()) as InstagramApiResponse;
      if (!response.ok || !data.overview) {
        throw new Error(data.error ?? "Erro ao carregar painel de Instagram.");
      }
      setOverview(data.overview);
      setTopPosts(data.topPosts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Criatus 3D</p>
          <h1 className="text-2xl font-bold text-white">Dashboard de Campanhas Meta</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/instagram" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white transition">
            Instagram
          </Link>
          <Link href="/dashboard/campanhas" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white transition">
            Campanhas
          </Link>
          <Link href="/dashboard/historico" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white transition">
            📋 Histórico
          </Link>
          <Link href="/dashboard/agente" className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition">
            🤖 Agente IA
          </Link>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-soft"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? <p className="text-sm text-muted">Carregando dados...</p> : null}
      {error ? <p className="rounded-lg bg-rose-900/20 p-3 text-sm text-rose-300">{error}</p> : null}

      {overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Seguidores"
              value={formatNumber(overview.followers)}
              subtitle={`Variacao semanal: ${overview.followersWeeklyDelta >= 0 ? "+" : ""}${formatNumber(overview.followersWeeklyDelta)}`}
            />
            <MetricCard title="Alcance 30 dias" value={formatNumber(overview.reach30d)} />
            <MetricCard title="Views Reels 30 dias" value={formatNumber(overview.views30d)} />
            <MetricCard title="Curtidas 30 dias" value={formatNumber(overview.likes30d)} />
            <MetricCard title="Comentarios 30 dias" value={formatNumber(overview.comments30d)} />
            <MetricCard title="Total Interacoes 30 dias" value={formatNumber(overview.totalInteractions30d)} />
          </section>

          <TopPosts posts={topPosts} />
        </>
      ) : null}
    </main>
  );
}
