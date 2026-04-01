const INSTAGRAM_API_BASE_URL = "https://graph.instagram.com/v23.0";
const META_ADS_BASE_URL = "https://graph.facebook.com/v23.0";

type JsonObject = Record<string, unknown>;

type MetaCampaignStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "IN_PROCESS" | "WITH_ISSUES" | "CAMPAIGN_PAUSED" | "PENDING_REVIEW" | "DISAPPROVED" | "PREAPPROVED";

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
  plays: number;
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
  effectiveStatus: string;
  objective: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  frequency: number;
  startTime: string;
  stopTime: string;
  dailyBudget: number;
  lifetimeBudget: number;
}

export interface CampaignDailyInsight {
  date: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
}

export interface CampaignDetails extends AdsCampaign {
  dailyInsights: CampaignDailyInsight[];
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
  const token = baseUrl === META_ADS_BASE_URL
    ? getRequiredEnv("META_ADS_TOKEN")
    : getRequiredEnv("INSTAGRAM_TOKEN");
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

async function fetchMediaInsights(mediaId: string, mediaType: string): Promise<{ plays: number; shares: number; saved: number }> {
  try {
    const metric = mediaType === "VIDEO" ? "plays,shares,saved" : "shares,saved";
    const data = await metaFetch<JsonObject>(`/${mediaId}/insights?metric=${metric}`);
    const items = normalizeArray<JsonObject>((data as JsonObject).data);
    const getVal = (name: string) => {
      const item = items.find((x) => x.name === name);
      if (!item) return 0;
      const firstVal = normalizeArray<JsonObject>(item.values)[0];
      return Number(firstVal?.value ?? item.value ?? 0);
    };
    return { plays: getVal("plays"), shares: getVal("shares"), saved: getVal("saved") };
  } catch {
    return { plays: 0, shares: 0, saved: 0 };
  }
}

export async function getInstagramMedia(days = 30): Promise<InstagramMediaItem[]> {
  const postsData = await metaFetch<JsonObject>(
    `/me/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,media_type&limit=50`,
  );

  const since = new Date();
  since.setDate(since.getDate() - days);

  const allPosts = normalizeArray<JsonObject>(postsData.data).filter((post) => {
    const ts = post.timestamp ? new Date(String(post.timestamp)) : null;
    return ts && ts >= since;
  });

  const recentPosts = allPosts.slice(0, 20);

  const insightsResults = await Promise.all(
    recentPosts.map((post) =>
      fetchMediaInsights(String(post.id ?? ""), String(post.media_type ?? "IMAGE")),
    ),
  );

  const posts = recentPosts.map((post, i) => {
    const likes = Number(post.like_count ?? 0);
    const comments = Number(post.comments_count ?? 0);
    const { plays, shares, saved } = insightsResults[i];
    const interactions = likes + comments + shares + saved;
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
      saves: saved,
      shares,
      plays,
    };
  });

  return posts.sort((a, b) => b.engagementRate - a.engagementRate);
}

// Keep old name as alias for backward compatibility
export async function getTopInstagramPosts(): Promise<InstagramPost[]> {
  return getInstagramMedia();
}

export async function getInstagramOverview(days = 30, cachedMedia?: InstagramMediaItem[]): Promise<InstagramOverview> {
  const sinceLastWeek = getDateDaysAgo(7);
  const sincePeriod = getDateDaysAgo(days);
  const untilToday = new Date().toISOString().split("T")[0];

  const [profileData, metricsData, onlineData, demoCityData, demoAgeGenderData] = await Promise.all([
    metaFetch<JsonObject>(`/me?fields=followers_count`),
    metaFetch<JsonObject>(
      `/me/insights?metric=reach,follower_count&period=day&since=${sincePeriod}&until=${untilToday}`,
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
  const reach30d = normalizeArray<JsonObject>(
    metricItems.find((item) => item.name === "reach")?.values,
  ).reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  // Use cached media or fetch fresh
  const mediaItems = cachedMedia ?? await getInstagramMedia(days);

  const views30d = mediaItems
    .filter((p) => p.mediaType === "VIDEO")
    .reduce((sum, p) => sum + p.plays, 0);

  const likes30d = mediaItems.reduce((sum, p) => sum + p.likes, 0);
  const comments30d = mediaItems.reduce((sum, p) => sum + p.comments, 0);
  const totalInteractions30d = mediaItems.reduce(
    (sum, p) => sum + p.likes + p.comments + p.shares + p.saves,
    0,
  );

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
    websiteClicks30d: 0,
    profileViews30d: 0,
    accountsEngaged30d: 0,
    likes30d,
    comments30d,
    shares30d: 0,
    saves30d: 0,
    followsAndUnfollows30d: 0,
    bestPostingHours,
    demographics: {
      cityFocus,
      ageRanges,
      genders,
    },
  };
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

export async function listAdsCampaigns(datePreset = "last_30d"): Promise<AdsCampaign[]> {
  const adAccountId = getRequiredEnv("META_AD_ACCOUNT_ID");

  const campaignsData = await metaFetch<JsonObject>(
    `/${adAccountId}/campaigns?fields=id,name,status,effective_status,objective,start_time,stop_time,daily_budget,lifetime_budget&limit=100`,
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
      `/${campaignId}/insights?fields=spend,reach,impressions,clicks,ctr,cpm,cpc,frequency&date_preset=${datePreset}`,
      undefined,
      META_ADS_BASE_URL,
    ).catch(() => ({ data: [] } as JsonObject));
    const firstInsight = normalizeArray<JsonObject>(insightsData.data)[0] ?? {};

    return {
      id: campaignId,
      name: String(campaign.name ?? "Campanha sem nome"),
      status: String(campaign.status ?? "PAUSED"),
      effectiveStatus: String(campaign.effective_status ?? campaign.status ?? "PAUSED"),
      objective: String(campaign.objective ?? ""),
      spend: Number(firstInsight.spend ?? 0),
      reach: Number(firstInsight.reach ?? 0),
      impressions: Number(firstInsight.impressions ?? 0),
      clicks: Number(firstInsight.clicks ?? 0),
      ctr: Number(firstInsight.ctr ?? 0),
      cpm: Number(firstInsight.cpm ?? 0),
      cpc: Number(firstInsight.cpc ?? 0),
      frequency: Number(firstInsight.frequency ?? 0),
      startTime: String(campaign.start_time ?? ""),
      stopTime: String(campaign.stop_time ?? ""),
      dailyBudget: Number(campaign.daily_budget ?? 0) / 100,
      lifetimeBudget: Number(campaign.lifetime_budget ?? 0) / 100,
    };
  });

  return Promise.all(insightsPromises);
}

export async function getCampaignDetails(campaignId: string): Promise<CampaignDetails> {
  const [campaignData, insightsData, dailyData] = await Promise.all([
    metaFetch<JsonObject>(
      `/${campaignId}?fields=id,name,status,effective_status,objective,start_time,stop_time,daily_budget,lifetime_budget`,
      undefined,
      META_ADS_BASE_URL,
    ),
    metaFetch<JsonObject>(
      `/${campaignId}/insights?fields=spend,reach,impressions,clicks,ctr,cpm,cpc,frequency&date_preset=lifetime`,
      undefined,
      META_ADS_BASE_URL,
    ).catch(() => ({ data: [] } as JsonObject)),
    metaFetch<JsonObject>(
      `/${campaignId}/insights?fields=spend,reach,impressions,clicks,cpm,cpc&time_increment=1&date_preset=last_30d`,
      undefined,
      META_ADS_BASE_URL,
    ).catch(() => ({ data: [] } as JsonObject)),
  ]);

  const insight = normalizeArray<JsonObject>(insightsData.data)[0] ?? {};
  const daily = normalizeArray<JsonObject>(dailyData.data).map((d) => ({
    date: String(d.date_start ?? ""),
    spend: Number(d.spend ?? 0),
    reach: Number(d.reach ?? 0),
    impressions: Number(d.impressions ?? 0),
    clicks: Number(d.clicks ?? 0),
    cpm: Number(d.cpm ?? 0),
    cpc: Number(d.cpc ?? 0),
  }));

  return {
    id: campaignId,
    name: String(campaignData.name ?? ""),
    status: String(campaignData.status ?? ""),
    effectiveStatus: String(campaignData.effective_status ?? ""),
    objective: String(campaignData.objective ?? ""),
    spend: Number(insight.spend ?? 0),
    reach: Number(insight.reach ?? 0),
    impressions: Number(insight.impressions ?? 0),
    clicks: Number(insight.clicks ?? 0),
    ctr: Number(insight.ctr ?? 0),
    cpm: Number(insight.cpm ?? 0),
    cpc: Number(insight.cpc ?? 0),
    frequency: Number(insight.frequency ?? 0),
    startTime: String(campaignData.start_time ?? ""),
    stopTime: String(campaignData.stop_time ?? ""),
    dailyBudget: Number(campaignData.daily_budget ?? 0) / 100,
    lifetimeBudget: Number(campaignData.lifetime_budget ?? 0) / 100,
    dailyInsights: daily,
  };
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
  objective: string;
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
