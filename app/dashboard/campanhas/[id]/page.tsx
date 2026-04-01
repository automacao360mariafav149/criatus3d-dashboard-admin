"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CampaignDetails } from "@/lib/meta-api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatDate(ts: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatShortDate(ts: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return ts;
  }
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/20 text-emerald-300",
  PAUSED: "bg-yellow-500/20 text-yellow-300",
  DELETED: "bg-rose-500/20 text-rose-300",
  ARCHIVED: "bg-white/10 text-muted",
  COMPLETED: "bg-slate-500/20 text-slate-300",
  IN_PROCESS: "bg-blue-500/20 text-blue-300",
  WITH_ISSUES: "bg-orange-500/20 text-orange-300",
  CAMPAIGN_PAUSED: "bg-yellow-500/20 text-yellow-300",
  PENDING_REVIEW: "bg-blue-500/20 text-blue-300",
  DISAPPROVED: "bg-rose-500/20 text-rose-300",
  PREAPPROVED: "bg-teal-500/20 text-teal-300",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  DELETED: "Deletada",
  ARCHIVED: "Arquivada",
  COMPLETED: "Concluída",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problemas",
  CAMPAIGN_PAUSED: "Pausada (conta)",
  PENDING_REVIEW: "Em revisão",
  DISAPPROVED: "Reprovada",
  PREAPPROVED: "Pré-aprovada",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-white/10 text-muted";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function DailyChart({ insights }: { insights: CampaignDetails["dailyInsights"] }) {
  const last14 = insights.slice(-14);

  if (!last14.length) {
    return (
      <p className="text-sm text-muted">Sem dados de desempenho diário disponíveis.</p>
    );
  }

  const maxImpressions = Math.max(...last14.map((d) => d.impressions), 1);

  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{ minHeight: "140px" }}>
      {last14.map((day) => {
        const heightPct = Math.max((day.impressions / maxImpressions) * 100, 2);
        const tooltipText = `${formatShortDate(day.date)}\nGasto: ${currency(day.spend)}\nImpressões: ${formatNumber(day.impressions)}`;
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1" style={{ minWidth: "28px" }}>
            <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
              <div
                title={tooltipText}
                className="w-full rounded-t-sm bg-accent opacity-80 hover:opacity-100 transition-opacity cursor-default"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[10px] text-muted whitespace-nowrap">{formatShortDate(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [data, setData] = useState<CampaignDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${BASE_PATH}/api/campaigns/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as CampaignDetails & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Erro ao carregar campanha.");
        setData(json);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/campanhas"
            className="text-xs text-muted hover:text-white transition flex items-center gap-1"
          >
            ← Voltar para campanhas
          </Link>
          {loading ? (
            <h1 className="text-2xl font-bold text-white">Carregando...</h1>
          ) : data ? (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{data.name}</h1>
              <StatusBadge status={data.effectiveStatus || data.status} />
            </div>
          ) : null}
          {data && (
            <p className="text-sm text-muted">
              {formatDate(data.startTime)}
              {data.stopTime ? ` → ${formatDate(data.stopTime)}` : ""}
            </p>
          )}
        </div>
      </header>

      {loading && (
        <p className="text-sm text-muted">Carregando detalhes da campanha...</p>
      )}

      {error && (
        <p className="rounded-lg bg-rose-900/20 p-3 text-sm text-rose-300">{error}</p>
      )}

      {data && (
        <>
          {/* Summary cards — 2×4 grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total investido" value={currency(data.spend)} />
            <SummaryCard label="Alcance" value={formatNumber(data.reach)} />
            <SummaryCard label="Impressões" value={formatNumber(data.impressions)} />
            <SummaryCard label="Cliques" value={formatNumber(data.clicks)} />
            <SummaryCard label="CTR" value={`${data.ctr.toFixed(2)}%`} />
            <SummaryCard label="CPM" value={currency(data.cpm)} />
            <SummaryCard label="CPC" value={currency(data.cpc)} />
            <SummaryCard label="Frequência" value={`${data.frequency.toFixed(1)} x`} />
          </div>

          {/* Budget */}
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="mb-3 text-base font-semibold text-white">Orçamento</h2>
            {data.dailyBudget > 0 ? (
              <p className="text-sm text-muted">
                Orçamento diário:{" "}
                <span className="font-semibold text-white">{currency(data.dailyBudget)}</span>
              </p>
            ) : data.lifetimeBudget > 0 ? (
              <p className="text-sm text-muted">
                Orçamento total:{" "}
                <span className="font-semibold text-white">{currency(data.lifetimeBudget)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted">Orçamento não disponível.</p>
            )}
          </div>

          {/* Daily chart */}
          <div className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="mb-4 text-base font-semibold text-white">
              Desempenho diário — últimos 14 dias (impressões)
            </h2>
            <DailyChart insights={data.dailyInsights} />
          </div>

          {/* Daily data table */}
          {data.dailyInsights.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-card p-5">
              <h2 className="mb-4 text-base font-semibold text-white">Dados diários</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest text-muted">
                      <th className="pb-3 pr-4">Data</th>
                      <th className="pb-3 pr-4 text-right">Gasto</th>
                      <th className="pb-3 pr-4 text-right">Alcance</th>
                      <th className="pb-3 pr-4 text-right">Impressões</th>
                      <th className="pb-3 pr-4 text-right">Cliques</th>
                      <th className="pb-3 pr-4 text-right">CPM</th>
                      <th className="pb-3 text-right">CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyInsights.map((day) => (
                      <tr
                        key={day.date}
                        className="border-t border-white/10 text-white hover:bg-white/5"
                      >
                        <td className="py-2 pr-4 text-muted">{formatDate(day.date)}</td>
                        <td className="py-2 pr-4 text-right">
                          {day.spend > 0 ? currency(day.spend) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {day.reach > 0 ? formatNumber(day.reach) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {day.impressions > 0 ? formatNumber(day.impressions) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {day.clicks > 0 ? formatNumber(day.clicks) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {day.cpm > 0 ? currency(day.cpm) : "—"}
                        </td>
                        <td className="py-2 text-right">
                          {day.cpc > 0 ? currency(day.cpc) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
