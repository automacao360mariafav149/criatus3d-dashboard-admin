import Link from "next/link";
import type { AdsCampaign } from "@/lib/meta-api";

interface CampaignTableProps {
  campaigns: AdsCampaign[];
  onToggle: (campaignId: string, active: boolean) => Promise<void>;
  loadingId?: string | null;
}

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatDate(ts: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/20 text-emerald-300",
  PAUSED: "bg-yellow-500/20 text-yellow-300",
  ARCHIVED: "bg-white/10 text-muted",
  DELETED: "bg-rose-500/20 text-rose-300",
  COMPLETED: "bg-slate-500/20 text-slate-300",
  WITH_ISSUES: "bg-orange-500/20 text-orange-300",
  IN_PROCESS: "bg-blue-500/20 text-blue-300",
  CAMPAIGN_PAUSED: "bg-yellow-500/20 text-yellow-300",
  PENDING_REVIEW: "bg-blue-500/20 text-blue-300",
  DISAPPROVED: "bg-rose-500/20 text-rose-300",
  PREAPPROVED: "bg-teal-500/20 text-teal-300",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Deletada",
  COMPLETED: "Concluída",
  WITH_ISSUES: "Com problemas",
  IN_PROCESS: "Em processamento",
  CAMPAIGN_PAUSED: "Pausada (conta)",
  PENDING_REVIEW: "Em revisão",
  DISAPPROVED: "Reprovada",
  PREAPPROVED: "Pré-aprovada",
};

export function CampaignTable({ campaigns, onToggle, loadingId }: CampaignTableProps) {
  if (!campaigns.length) {
    return (
      <section className="rounded-2xl border border-white/10 bg-card p-5">
        <h2 className="text-lg font-semibold text-white">Todas as campanhas</h2>
        <p className="mt-4 text-sm text-muted">Nenhuma campanha encontrada no periodo.</p>
      </section>
    );
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalReach = campaigns.reduce((s, c) => s + c.reach, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);

  return (
    <section className="flex flex-col gap-5">
      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted uppercase tracking-widest">Total investido</p>
          <p className="mt-1 text-2xl font-bold text-white">{currency(totalSpend)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted uppercase tracking-widest">Alcance total</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatNumber(totalReach)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted uppercase tracking-widest">Impressoes totais</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatNumber(totalImpressions)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-4">
          <p className="text-xs text-muted uppercase tracking-widest">Cliques totais</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatNumber(totalClicks)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-white/10 bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Todas as campanhas ({campaigns.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-muted">
                <th className="pb-3 pr-4">Nome</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Periodo</th>
                <th className="pb-3 pr-4 text-right">Gasto</th>
                <th className="pb-3 pr-4 text-right">Alcance</th>
                <th className="pb-3 pr-4 text-right">Impressoes</th>
                <th className="pb-3 pr-4 text-right">Cliques</th>
                <th className="pb-3 pr-4 text-right">CPM</th>
                <th className="pb-3 text-right">CPC</th>
                <th className="pb-3 pl-4">Acao</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const displayStatus = campaign.effectiveStatus || campaign.status;
                const isActive = displayStatus === "ACTIVE";
                const isLoading = loadingId === campaign.id;
                const canToggle = campaign.status === "ACTIVE" || campaign.status === "PAUSED";
                const statusStyle = STATUS_STYLES[displayStatus] ?? "bg-white/10 text-muted";
                const statusLabel = STATUS_LABELS[displayStatus] ?? displayStatus;

                return (
                  <tr key={campaign.id} className="border-t border-white/10 text-white hover:bg-white/5">
                    <td className="py-3 pr-4 font-medium">
                      <Link href={`/dashboard/campanhas/${campaign.id}`} className="hover:text-accent transition">
                        {campaign.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted">
                      {formatDate(campaign.startTime)}
                      {campaign.stopTime ? ` → ${formatDate(campaign.stopTime)}` : ""}
                    </td>
                    <td className="py-3 pr-4 text-right">{campaign.spend > 0 ? currency(campaign.spend) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{campaign.reach > 0 ? formatNumber(campaign.reach) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{campaign.impressions > 0 ? formatNumber(campaign.impressions) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{campaign.clicks > 0 ? formatNumber(campaign.clicks) : "—"}</td>
                    <td className="py-3 pr-4 text-right">{campaign.cpm > 0 ? currency(campaign.cpm) : "—"}</td>
                    <td className="py-3 text-right">{campaign.cpc > 0 ? currency(campaign.cpc) : "—"}</td>
                    <td className="py-3 pl-4">
                      {canToggle ? (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => onToggle(campaign.id, campaign.status === "ACTIVE")}
                          className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent-soft disabled:opacity-60"
                        >
                          {isLoading ? "..." : campaign.status === "ACTIVE" ? "Pausar" : "Ativar"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
