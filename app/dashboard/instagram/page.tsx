"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { InstagramOverview, InstagramMediaItem, InstagramStory } from "@/lib/meta-api";

interface InstagramApiResponse {
  overview?: InstagramOverview;
  topPosts?: InstagramMediaItem[];
  stories?: InstagramStory[];
  error?: string;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatDate(timestamp: string) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return timestamp;
  }
}

type TabKey = "feed" | "reels" | "stories";

export default function InstagramPage() {
  const [overview, setOverview] = useState<InstagramOverview | null>(null);
  const [media, setMedia] = useState<InstagramMediaItem[]>([]);
  const [stories, setStories] = useState<InstagramStory[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("feed");
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
      setMedia(data.topPosts ?? []);
      setStories(data.stories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstagram();
  }, [loadInstagram]);

  const feedPosts = media.filter(
    (p) => p.mediaType === "IMAGE" || p.mediaType === "CAROUSEL_ALBUM",
  );
  const reelsPosts = media.filter((p) => p.mediaType === "VIDEO");

  const hasDemographics =
    overview &&
    (overview.demographics.cityFocus.length > 0 ||
      overview.demographics.ageRanges.length > 0 ||
      overview.demographics.genders.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Analise detalhada</p>
          <h1 className="text-2xl font-bold text-white">Instagram @criatus3d</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-3 py-2 text-sm text-muted hover:text-white">
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
          {/* Metrics grid */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <MetricCard
              title="Seguidores"
              value={formatNumber(overview.followers)}
              subtitle={`Variacao semanal: ${overview.followersWeeklyDelta >= 0 ? "+" : ""}${formatNumber(overview.followersWeeklyDelta)}`}
            />
            <MetricCard title="Alcance 30d" value={formatNumber(overview.reach30d)} />
            <MetricCard title="Visualizacoes 30d" value={formatNumber(overview.views30d)} />
            <MetricCard title="Contas engajadas 30d" value={formatNumber(overview.accountsEngaged30d)} />
            <MetricCard title="Interacoes totais 30d" value={formatNumber(overview.totalInteractions30d)} />
            <MetricCard title="Curtidas 30d" value={formatNumber(overview.likes30d)} />
            <MetricCard title="Comentarios 30d" value={formatNumber(overview.comments30d)} />
            <MetricCard title="Compartilhamentos 30d" value={formatNumber(overview.shares30d)} />
            <MetricCard title="Salvamentos 30d" value={formatNumber(overview.saves30d)} />
            <MetricCard title="Visitas ao perfil 30d" value={formatNumber(overview.profileViews30d)} />
            <MetricCard
              title="Cliques no link 30d"
              value={overview.websiteClicks30d > 0 ? formatNumber(overview.websiteClicks30d) : "Sem dados"}
            />
            <MetricCard
              title="Seguidores ganhos/perdidos 30d"
              value={overview.followsAndUnfollows30d >= 0
                ? `+${formatNumber(overview.followsAndUnfollows30d)}`
                : formatNumber(overview.followsAndUnfollows30d)}
            />
          </section>

          {/* Tabs: Feed / Reels / Stories */}
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              {(["feed", "reels", "stories"] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-accent text-white"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {tab === "feed" ? `Feed (${feedPosts.length})` : null}
                  {tab === "reels" ? `Reels (${reelsPosts.length})` : null}
                  {tab === "stories" ? `Stories (${stories.length})` : null}
                </button>
              ))}
            </div>

            {/* Feed */}
            {activeTab === "feed" ? (
              feedPosts.length === 0 ? (
                <p className="text-sm text-muted">Nenhum post encontrado.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {feedPosts.map((post) => (
                    <a
                      key={post.id}
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 transition hover:border-fuchsia-300/50"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-black/30">
                        {(post.thumbnailUrl ?? post.mediaUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(post.thumbnailUrl ?? post.mediaUrl)!}
                            alt="Post Instagram"
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted">
                            Sem imagem
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="mb-1 text-xs text-muted">{formatDate(post.timestamp)}</p>
                        <p className="line-clamp-2 text-sm text-white">{post.caption}</p>
                        <p className="mt-2 text-xs text-muted">
                          {post.likes} curtidas &middot; {post.comments} coments
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )
            ) : null}

            {/* Reels */}
            {activeTab === "reels" ? (
              reelsPosts.length === 0 ? (
                <p className="text-sm text-muted">Nenhum reel encontrado.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {reelsPosts.map((post) => (
                    <a
                      key={post.id}
                      href={post.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-xl border border-white/10 bg-black/20 transition hover:border-fuchsia-300/50"
                    >
                      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black/30">
                        {(post.thumbnailUrl ?? post.mediaUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(post.thumbnailUrl ?? post.mediaUrl)!}
                            alt="Reel Instagram"
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted">
                            Sem preview
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                          VIDEO
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="mb-1 text-xs text-muted">{formatDate(post.timestamp)}</p>
                        <p className="line-clamp-2 text-sm text-white">{post.caption}</p>
                        <p className="mt-2 text-xs text-muted">
                          {post.likes} curtidas &middot; {post.comments} coments
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )
            ) : null}

            {/* Stories */}
            {activeTab === "stories" ? (
              stories.length === 0 ? (
                <p className="text-sm text-muted">Nenhum story ativo no momento.</p>
              ) : (
                <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {stories.map((story) => (
                    <div
                      key={story.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
                    >
                      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black/30">
                        {(story.thumbnailUrl ?? story.mediaUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(story.thumbnailUrl ?? story.mediaUrl)!}
                            alt="Story Instagram"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted">
                            Sem preview
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-muted">{formatDate(story.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </section>

          {/* Demographics */}
          {hasDemographics ? (
            <section className="grid gap-4 lg:grid-cols-3">
              {overview.demographics.cityFocus.length > 0 ? (
                <article className="rounded-2xl border border-white/10 bg-card p-5">
                  <h2 className="text-lg font-semibold text-white">Top cidades</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {overview.demographics.cityFocus.map((item) => (
                      <li key={item.city} className="flex justify-between text-muted">
                        <span>{item.city}</span>
                        <span className="text-white">{formatNumber(item.audience)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}

              {overview.demographics.ageRanges.length > 0 ? (
                <article className="rounded-2xl border border-white/10 bg-card p-5">
                  <h2 className="text-lg font-semibold text-white">Faixas etarias</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {overview.demographics.ageRanges.map((item) => (
                      <li key={item.range} className="flex justify-between text-muted">
                        <span>{item.range}</span>
                        <span className="text-white">{formatNumber(item.audience)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}

              {overview.demographics.genders.length > 0 ? (
                <article className="rounded-2xl border border-white/10 bg-card p-5">
                  <h2 className="text-lg font-semibold text-white">Genero</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {overview.demographics.genders.map((item) => (
                      <li key={item.gender} className="flex justify-between text-muted">
                        <span>{item.gender.toUpperCase()}</span>
                        <span className="text-white">{formatNumber(item.audience)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
