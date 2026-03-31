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

export default function InstagramPage() {
  const [overview, setOverview] = useState<InstagramOverview | null>(null);
  const [topPosts, setTopPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstagram = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/instagram`, { cache: "no-store" });
      const data = (await response.json()) as InstagramApiResponse;
      if (!response.ok || !data.overview) {
        throw new Error(data.error ?? "Nao foi possivel carregar a analise do Instagram.");
      }
      setOverview(data.overview);
      setTopPosts(data.topPosts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstagram();
  }, [loadInstagram]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Analise detalhada</p>
          <h1 className="text-2xl font-bold text-white">Instagram @criatus3d</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-3 py-2 text-sm">
            Voltar
          </Link>
          <button
            onClick={() => void loadInstagram()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-soft"
            type="button"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? <p className="text-sm text-muted">Carregando dados...</p> : null}
      {error ? <p className="rounded-lg bg-rose-900/20 p-3 text-sm text-rose-300">{error}</p> : null}

      {overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Seguidores" value={overview.followers.toLocaleString("pt-BR")} />
            <MetricCard
              title="Variacao semanal"
              value={`${overview.followersWeeklyDelta >= 0 ? "+" : ""}${overview.followersWeeklyDelta.toLocaleString("pt-BR")}`}
            />
            <MetricCard title="Alcance 30 dias" value={overview.reach30d.toLocaleString("pt-BR")} />
            <MetricCard title="Impressoes 30 dias" value={overview.impressions30d.toLocaleString("pt-BR")} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-fuchsia-300/20 bg-card p-5">
              <h2 className="text-lg font-semibold text-white">Cidades com foco</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.demographics.cityFocus.map((item) => (
                  <li key={item.city} className="flex justify-between text-muted">
                    <span>{item.city}</span>
                    <span>{item.audience.toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-fuchsia-300/20 bg-card p-5">
              <h2 className="text-lg font-semibold text-white">Faixas de idade</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.demographics.ageRanges.map((item) => (
                  <li key={item.range} className="flex justify-between text-muted">
                    <span>{item.range}</span>
                    <span>{item.audience.toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-fuchsia-300/20 bg-card p-5">
              <h2 className="text-lg font-semibold text-white">Genero</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {overview.demographics.genders.map((item) => (
                  <li key={item.gender} className="flex justify-between text-muted">
                    <span>{item.gender.toUpperCase()}</span>
                    <span>{item.audience.toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <TopPosts posts={topPosts} />
        </>
      ) : null}
    </main>
  );
}
