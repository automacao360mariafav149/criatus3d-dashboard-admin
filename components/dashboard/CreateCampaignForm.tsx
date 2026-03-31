"use client";

import { FormEvent, useState } from "react";

interface CreateCampaignFormProps {
  onCreated: () => Promise<void>;
}

const defaultCities = ["Contagem", "Belo Horizonte", "Regiao Metropolitana"];
const defaultInterests = ["pets", "decoracao", "presentes"];
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function CreateCampaignForm({ onCreated }: CreateCampaignFormProps) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<"FOLLOWERS" | "BRAND_AWARENESS">("FOLLOWERS");
  const [dailyBudget, setDailyBudget] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cities, setCities] = useState(defaultCities.join(", "));
  const [interests, setInterests] = useState(defaultInterests.join(", "));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${BASE_PATH}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective,
          dailyBudget,
          startDate,
          endDate,
          cities: cities.split(",").map((item) => item.trim()),
          interests: interests.split(",").map((item) => item.trim()),
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nao foi possivel criar a campanha.");
      }

      setMessage(data.message ?? "Campanha criada com sucesso.");
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao criar campanha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-fuchsia-300/20 bg-card p-5">
      <h2 className="text-lg font-semibold text-white">Criar nova campanha</h2>

      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome da campanha"
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        />
        <select
          value={objective}
          onChange={(event) =>
            setObjective(event.target.value === "FOLLOWERS" ? "FOLLOWERS" : "BRAND_AWARENESS")
          }
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        >
          <option value="FOLLOWERS">Seguidores</option>
          <option value="BRAND_AWARENESS">Reconhecimento</option>
        </select>
        <input
          required
          type="number"
          min={5}
          value={dailyBudget}
          onChange={(event) => setDailyBudget(Number(event.target.value))}
          placeholder="Orcamento diario (R$)"
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        />
        <input
          required
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        />
        <input
          required
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        />
        <input
          value={cities}
          onChange={(event) => setCities(event.target.value)}
          placeholder="Cidades (separadas por virgula)"
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        />
        <input
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
          placeholder="Interesses (separados por virgula)"
          className="rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white md:col-span-2"
        />
        <button
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-soft disabled:opacity-60"
          type="submit"
        >
          {loading ? "Criando..." : "Criar campanha"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
