const META_GRAPH_BASE_URL = "https://graph.facebook.com/v23.0";

type JsonObject = Record<string, unknown>;

type MetaCampaignStatus = "ACTIVE" | "PAUSED";

export interface InstagramOverview {
  followers: number;
  followersWeeklyDelta: number;
  reach30d: number;
  impressions30d: number;
  bestPostingHours: string[];
  demographics: {
    cityFocus: Array<{ city: string; audience: number }>;
    ageRanges: Array<{ range: string; audience: number }>;
    genders: Array<{ gender: string; audience: number }>;
  };
}

export interface InstagramPost {
  id: string;
  caption: string;
  permalink: string;
  mediaUrl: string | null;
  timestamp: string;
  likes: number;
  comments: number;
  engagementRate: number;
}

export interface AdsCampaign {
  id: string;
  name: string;
  status: MetaCampaignStatus | string;
  spend: number;
  reach: number;
  cpm: number;
  cpc: number;
}

interface MetaError {
  error?: {
    message?: string;
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`A variavel ${name} nao foi configurada no servidor.`);
  }
  return value;
}

async function metaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getRequiredEnv("INSTAGRAM_TOKEN");
  const url = new URL(`${META_GRAPH_BASE_URL}${path}`);
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as MetaError;
    const message =
      errorPayload.error?.message ??
      "Nao foi possivel completar a requisicao para a API da Meta.";
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function normalizeArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as T[];
}

function getFirstMetricValueMap(items: JsonObject[], metricName: string): Record<string, number> {
  const metric = items.find((item) => item.name === metricName);
  const values = normalizeArray<JsonObject>(metric?.values);
  const first = values[0];
  if (!first || typeof first.value !== "object" || !first.value) {
    return {};
  }
  return first.value as Record<string, number>;
}

export async function getInstagramOverview(): Promise<InstagramOverview> {
  const igAccountId = getRequiredEnv("INSTAGRAM_ACCOUNT_ID");
  const sinceLastWeek = getDateDaysAgo(7);
  const since30Days = getDateDaysAgo(30);
  const untilToday = new Date().toISOString().split("T")[0];

  const [profileData, metricsData, audienceData] = await Promise.all([
    metaFetch<JsonObject>(`/${igAccountId}?fields=followers_count`),
    metaFetch<JsonObject>(
      `/${igAccountId}/insights?metric=reach,impressions,follower_count&period=day&since=${since30Days}&until=${untilToday}`,
    ),
    metaFetch<JsonObject>(
      `/${igAccountId}/insights?metric=audience_city,audience_gender_age,audience_online_followers&period=lifetime`,
    ),
  ]);

  const followers = Number(profileData.followers_count ?? 0);
  const metricItems = normalizeArray<JsonObject>(metricsData.data);

  const followerHistory = normalizeArray<JsonObject>(
    metricItems.find((item) => item.name === "follower_count")?.values,
  );

  const weekAgoFollowers =
    Number(
      followerHistory.find(
        (entry) => typeof entry.end_time === "string" && entry.end_time.includes(sinceLastWeek),
      )?.value ?? followerHistory.at(0)?.value ?? followers,
    ) || followers;

  const followersWeeklyDelta = followers - weekAgoFollowers;

  const reach30d = normalizeArray<JsonObject>(
    metricItems.find((item) => item.name === "reach")?.values,
  ).reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  const impressions30d = normalizeArray<JsonObject>(
    metricItems.find((item) => item.name === "impressions")?.values,
  ).reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  const audienceItems = normalizeArray<JsonObject>(audienceData.data);
  const cityMap = getFirstMetricValueMap(audienceItems, "audience_city");
  const ageGenderMap = getFirstMetricValueMap(audienceItems, "audience_gender_age");
  const onlineFollowersMap = getFirstMetricValueMap(audienceItems, "audience_online_followers");

  const cityFocus = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .filter(([city]) =>
      ["belo horizonte", "contagem", "betim", "ribeirao das neves"].some((target) =>
        city.toLowerCase().includes(target),
      ),
    )
    .slice(0, 6)
    .map(([city, audience]) => ({ city, audience }));

  const ageRanges = Object.entries(ageGenderMap).reduce(
    (acc, [key, audience]) => {
      const ageRange = key.split(".")[1] ?? "desconhecido";
      acc[ageRange] = (acc[ageRange] ?? 0) + audience;
      return acc;
    },
    {} as Record<string, number>,
  );

  const genders = Object.entries(ageGenderMap).reduce(
    (acc, [key, audience]) => {
      const gender = key.split(".")[0] ?? "u";
      acc[gender] = (acc[gender] ?? 0) + audience;
      return acc;
    },
    {} as Record<string, number>,
  );

  const bestPostingHours = Object.entries(onlineFollowersMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([hour]) => `${hour}:00`);

  return {
    followers,
    followersWeeklyDelta,
    reach30d,
    impressions30d,
    bestPostingHours,
    demographics: {
      cityFocus,
      ageRanges: Object.entries(ageRanges).map(([range, audience]) => ({ range, audience })),
      genders: Object.entries(genders).map(([gender, audience]) => ({ gender, audience })),
    },
  };
}

export async function getTopInstagramPosts(): Promise<InstagramPost[]> {
  const igAccountId = getRequiredEnv("INSTAGRAM_ACCOUNT_ID");
  const postsData = await metaFetch<JsonObject>(
    `/${igAccountId}/media?fields=id,caption,media_url,permalink,timestamp,like_count,comments_count&limit=30`,
  );

  const posts = normalizeArray<JsonObject>(postsData.data).map((post) => {
    const likes = Number(post.like_count ?? 0);
    const comments = Number(post.comments_count ?? 0);
    const interactions = likes + comments;
    const engagementRate = interactions > 0 ? Number((interactions / 100).toFixed(2)) : 0;

    return {
      id: String(post.id ?? ""),
      caption: String(post.caption ?? "Sem legenda"),
      permalink: String(post.permalink ?? "#"),
      mediaUrl: post.media_url ? String(post.media_url) : null,
      timestamp: String(post.timestamp ?? ""),
      likes,
      comments,
      engagementRate,
    };
  });

  return posts
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 6);
}

export async function listAdsCampaigns(): Promise<AdsCampaign[]> {
  const adAccountId = getRequiredEnv("META_AD_ACCOUNT_ID");

  const campaignsData = await metaFetch<JsonObject>(
    `/${adAccountId}/campaigns?fields=id,name,status&limit=50`,
  );

  const campaigns = normalizeArray<JsonObject>(campaignsData.data);
  if (!campaigns.length) {
    return [];
  }

  const insightsPromises = campaigns.map(async (campaign) => {
    const campaignId = String(campaign.id ?? "");
    const insightsData = await metaFetch<JsonObject>(
      `/${campaignId}/insights?fields=spend,reach,cpm,cpc&date_preset=last_30d`,
    );
    const firstInsight = normalizeArray<JsonObject>(insightsData.data)[0] ?? {};

    return {
      id: campaignId,
      name: String(campaign.name ?? "Campanha sem nome"),
      status: String(campaign.status ?? "PAUSED"),
      spend: Number(firstInsight.spend ?? 0),
      reach: Number(firstInsight.reach ?? 0),
      cpm: Number(firstInsight.cpm ?? 0),
      cpc: Number(firstInsight.cpc ?? 0),
    };
  });

  return Promise.all(insightsPromises);
}

export async function toggleCampaignStatus(
  campaignId: string,
  status: MetaCampaignStatus,
): Promise<void> {
  await metaFetch<JsonObject>(`/${campaignId}`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

interface CreateCampaignInput {
  name: string;
  objective: "FOLLOWERS" | "BRAND_AWARENESS";
  dailyBudget: number;
  startDate: string;
  endDate: string;
  cities: string[];
  interests: string[];
}

export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  const adAccountId = getRequiredEnv("META_AD_ACCOUNT_ID");
  const payload = {
    name: input.name,
    objective: input.objective,
    status: "PAUSED",
    daily_budget: Math.round(input.dailyBudget * 100),
    start_time: new Date(input.startDate).toISOString(),
    stop_time: new Date(input.endDate).toISOString(),
    special_ad_categories: [],
    // Campos de segmentacao sao recebidos para o backend evoluir criativos/adsets.
    targeting_context: JSON.stringify({
      cities: input.cities,
      interests: input.interests,
    }),
  };

  const response = await metaFetch<JsonObject>(`/${adAccountId}/campaigns`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return String(response.id ?? "");
}
