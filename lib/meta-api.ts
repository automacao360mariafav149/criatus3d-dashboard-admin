const INSTAGRAM_API_BASE_URL = "https://graph.instagram.com/v23.0";
const META_ADS_BASE_URL = "https://graph.facebook.com/v23.0";

type JsonObject = Record<string, unknown>;

type MetaCampaignStatus = "ACTIVE" | "PAUSED";

export interface InstagramOverview {
  followers: number;
  followersWeeklyDelta: number;
  reach30d: number;
  impressions30d: number;
  views30d: number;
  totalInteractions30d: number;
  websiteClicks30d: number;
  profileViews30d: number;
  accountsEngaged30d: number;
  likes30d: number;
  comments30d: number;
  shares30d: number;
  saves30d: number;
  followsAndUnfollows30d: number;
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
  thumbnailUrl: string | null;
  timestamp: string;
  likes: number;
  comments: number;
  engagementRate: number;
}

export interface InstagramMediaItem extends InstagramPost {
  mediaType: string;
  saves: number;
  shares: number;
}

export interface InstagramStory {
  id: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
  mediaType: string;
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

async function metaFetch<T>(path: string, init?: RequestInit, baseUrl = INSTAGRAM_API_BASE_URL): Promise<T> {
  const token = getRequiredEnv("INSTAGRAM_TOKEN");
  const url = new URL(`${baseUrl}${path}`);

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
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

function sumMetricValues(metricItems: JsonObject[], metricName: string): number {
  return normalizeArray<JsonObject>(
    metricItems.find((item) => item.name === metricName)?.values,
  ).reduce((sum, item) => sum + Number(item.value ?? 0), 0);
}

function parseDemographicsBreakdown(
  data: JsonObject[],
  metricName: string,
  dimensionKey: string,
): Array<{ key: string; value: number }> {
  const metric = data.find((item) => item.name === metricName);
  if (!metric) return [];

  const totalValue = metric.total_value as JsonObject | undefined;
  if (!totalValue) return [];

  const breakdowns = normalizeArray<JsonObject>(totalValue.breakdowns);
  const breakdown = breakdowns.find((b) => {
    const keys = normalizeArray<string>(b.dimension_keys);
    return keys.includes(dimensionKey);
  });
  if (!breakdown) return [];

  const results = normalizeArray<JsonObject>(breakdown.results);
  return results.map((r) => {
    const dimValues = normalizeArray<string>(r.dimension_values);
    return {
      key: dimValues[0] ?? "Desconhecido",
      value: Number(r.value ?? 0),
    };
  });
}

export async function getInstagramOverview(): Promise<InstagramOverview> {
  const sinceLastWeek = getDateDaysAgo(7);
  const since30Days = getDateDaysAgo(30);
  const untilToday = new Date().toISOString().split("T")[0];

  const metricsParam =
    "reach,follower_count,views,total_interactions,likes,comments,shares,saves,website_clicks,profile_views,accounts_engaged,follows_and_unfollows";

  const [profileData, metricsData, onlineData, demoCityData, demoAgeGenderData] = await Promise.all([
    metaFetch<JsonObject>(`/me?fields=followers_count`),
    metaFetch<JsonObject>(
      `/me/insights?metric=${metricsParam}&period=day&since=${since30Days}&until=${untilToday}`,
    ),
    metaFetch<JsonObject>(`/me/insights?metric=online_followers&period=lifetime`),
    metaFetch<JsonObject>(
      `/me/insights?metric=follower_demographics&period=lifetime&breakdown=city`,
    ).catch(() => ({ data: [] } as JsonObject)),
    metaFetch<JsonObject>(
      `/me/insights?metric=follower_demographics&period=lifetime&breakdown=age,gender`,
    ).catch(() => ({ data: [] } as JsonObject)),
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

  const reach30d = sumMetricValues(metricItems, "reach");
  const views30d = sumMetricValues(metricItems, "views");
  const totalInteractions30d = sumMetricValues(metricItems, "total_interactions");
  const likes30d = sumMetricValues(metricItems, "likes");
  const comments30d = sumMetricValues(metricItems, "comments");
  const shares30d = sumMetricValues(metricItems, "shares");
  const saves30d = sumMetricValues(metricItems, "saves");
  const websiteClicks30d = sumMetricValues(metricItems, "website_clicks");
  const profileViews30d = sumMetricValues(metricItems, "profile_views");
  const accountsEngaged30d = sumMetricValues(metricItems, "accounts_engaged");
  const followsAndUnfollows30d = sumMetricValues(metricItems, "follows_and_unfollows");

  const onlineItems = normalizeArray<JsonObject>(onlineData.data);
  const onlineFollowersMap = getFirstMetricValueMap(onlineItems, "online_followers");

  const bestPostingHours = Object.entries(onlineFollowersMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([hour]) => `${hour}:00`);

  // Parse city demographics
  const cityItems = normalizeArray<JsonObject>((demoCityData as JsonObject).data);
  const cityRaw = parseDemographicsBreakdown(cityItems, "follower_demographics", "city");
  const cityFocus = cityRaw
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((item) => ({ city: item.key, audience: item.value }));

  // Parse age/gender demographics
  const ageGenderItems = normalizeArray<JsonObject>((demoAgeGenderData as JsonObject).data);
  const ageRaw = parseDemographicsBreakdown(ageGenderItems, "follower_demographics", "age");
  const genderRaw = parseDemographicsBreakdown(ageGenderItems, "follower_demographics", "gender");

  const ageRanges = ageRaw
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ range: item.key, audience: item.value }));

  const genders = genderRaw.map((item) => ({ gender: item.key, audience: item.value }));

  return {
    followers,
    followersWeeklyDelta,
    reach30d,
    impressions30d: 0,
    views30d,
    totalInteractions30d,
    websiteClicks30d,
    profileViews30d,
    accountsEngaged30d,
    likes30d,
    comments30d,
    shares30d,
    saves30d,
    followsAndUnfollows30d,
    bestPostingHours,
    demographics: {
      cityFocus,
      ageRanges,
      genders,
    },
  };
}

export async function getInstagramMedia(): Promise<InstagramMediaItem[]> {
  const postsData = await metaFetch<JsonObject>(
    `/me/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,media_type&limit=30`,
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
      thumbnailUrl: post.thumbnail_url ? String(post.thumbnail_url) : null,
      timestamp: String(post.timestamp ?? ""),
      likes,
      comments,
      engagementRate,
      mediaType: String(post.media_type ?? "IMAGE"),
      saves: 0,
      shares: 0,
    };
  });

  return posts.sort((a, b) => b.engagementRate - a.engagementRate);
}

// Keep old name as alias for backward compatibility
export async function getTopInstagramPosts(): Promise<InstagramPost[]> {
  return getInstagramMedia();
}

export async function getInstagramStories(): Promise<InstagramStory[]> {
  try {
    const storiesData = await metaFetch<JsonObject>(
      `/me/stories?fields=id,media_url,thumbnail_url,timestamp,media_type`,
    );
    return normalizeArray<JsonObject>(storiesData.data).map((story) => ({
      id: String(story.id ?? ""),
      mediaUrl: story.media_url ? String(story.media_url) : null,
      thumbnailUrl: story.thumbnail_url ? String(story.thumbnail_url) : null,
      timestamp: String(story.timestamp ?? ""),
      mediaType: String(story.media_type ?? "IMAGE"),
    }));
  } catch {
    return [];
  }
}

export async function listAdsCampaigns(): Promise<AdsCampaign[]> {
  const adAccountId = getRequiredEnv("META_AD_ACCOUNT_ID");

  const campaignsData = await metaFetch<JsonObject>(
    `/${adAccountId}/campaigns?fields=id,name,status&limit=50`,
    undefined,
    META_ADS_BASE_URL,
  );

  const campaigns = normalizeArray<JsonObject>(campaignsData.data);
  if (!campaigns.length) {
    return [];
  }

  const insightsPromises = campaigns.map(async (campaign) => {
    const campaignId = String(campaign.id ?? "");
    const insightsData = await metaFetch<JsonObject>(
      `/${campaignId}/insights?fields=spend,reach,cpm,cpc&date_preset=last_30d`,
      undefined,
      META_ADS_BASE_URL,
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
  }, META_ADS_BASE_URL);
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
  }, META_ADS_BASE_URL);

  return String(response.id ?? "");
}
