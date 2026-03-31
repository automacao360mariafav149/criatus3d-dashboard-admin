import type { AdsCampaign } from "@/lib/meta-api";

interface CampaignTableProps {
  campaigns: AdsCampaign[];
  onToggle: (campaignId: string, active: boolean) => Promise<void>;
  loadingId?: string | null;
}

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CampaignTable({ campaigns, onToggle, loadingId }: CampaignTableProps) {
  return (
    <section className="rounded-2xl border border-fuchsia-300/20 bg-card p-5">
      <h2 className="text-lg font-semibold text-white">Campanhas ativas</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="py-2 pr-3">Nome</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Gasto</th>
              <th className="py-2 pr-3">Alcance</th>
              <th className="py-2 pr-3">CPM</th>
              <th className="py-2 pr-3">CPC</th>
              <th className="py-2">Acao</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
              const isActive = campaign.status === "ACTIVE";
              const isLoading = loadingId === campaign.id;
              return (
                <tr key={campaign.id} className="border-t border-white/10 text-white">
                  <td className="py-3 pr-3">{campaign.name}</td>
                  <td className="py-3 pr-3">{campaign.status}</td>
                  <td className="py-3 pr-3">{currency(campaign.spend)}</td>
                  <td className="py-3 pr-3">{campaign.reach}</td>
                  <td className="py-3 pr-3">{currency(campaign.cpm)}</td>
                  <td className="py-3 pr-3">{currency(campaign.cpc)}</td>
                  <td className="py-3">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => onToggle(campaign.id, isActive)}
                      className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent-soft disabled:opacity-60"
                    >
                      {isLoading ? "Atualizando..." : isActive ? "Pausar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
