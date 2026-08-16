import { config, validateRapidApiKey } from '../config.js';
import { getCachedData, setCachedData, checkAndIncrementQuota } from '../quotaGuard.js';
import type { TripAdvisorSearchResult, TripAdvisorReview } from '../types.js';

interface RapidSearchResponse {
  data?: Array<{
    result_type?: string;
    result_object?: {
      location_id?: string;
      name?: string;
      address?: string;
      rating?: string;
      num_reviews?: string;
      category?: {
        name?: string;
      };
      ranking?: string;
      price_level?: string;
    };
  }>;
}

interface RapidReviewsResponse {
  data?: Array<{
    id?: string;
    title?: string;
    text?: string;
    rating?: number;
    published_date?: string;
    user?: {
      username?: string;
    };
  }>;
}

export async function searchTripAdvisor(
  query: string,
  category: 'attractions' | 'restaurants' | 'hotels' | 'geos' = 'attractions'
): Promise<{ results: TripAdvisorSearchResult[]; fromCache: boolean; remainingDailyQuota: number }> {
  validateRapidApiKey();

  const cacheKey = `tripadvisor_search_${category}_${query.toLowerCase().trim()}`;
  const cached = getCachedData<TripAdvisorSearchResult[]>(cacheKey);
  if (cached) {
    return { results: cached, fromCache: true, remainingDailyQuota: 0 };
  }

  const quota = checkAndIncrementQuota('rapidapi');
  if (!quota.allowed) {
    throw new Error(`Limite diário de segurança da RapidAPI atingido (${quota.countToday} chamadas hoje). Protegendo o Free Tier.`);
  }

  const url = new URL(`https://${config.rapidApiTripAdvisorHost}/locations/search`);
  url.searchParams.set('query', query);
  if (category) {
    url.searchParams.set('category', category);
  }
  url.searchParams.set('limit', '10');
  url.searchParams.set('offset', '0');
  url.searchParams.set('units', 'km');
  url.searchParams.set('currency', 'USD');
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('lang', 'pt_BR');

  const response = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': config.rapidApiKey,
      'x-rapidapi-host': config.rapidApiTripAdvisorHost,
    },
  });

  if (!response.ok) {
    throw new Error(`RapidAPI TripAdvisor error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RapidSearchResponse;
  const items = data.data || [];

  const results = items
    .filter((item) => item.result_object && item.result_object.location_id)
    .map((item) => {
      const obj = item.result_object!;
      return {
        locationId: obj.location_id || '',
        name: obj.name || '',
        address: obj.address,
        rating: obj.rating,
        numReviews: obj.num_reviews,
        category: obj.category?.name || item.result_type,
        ranking: obj.ranking,
        priceLevel: obj.price_level,
      };
    });

  setCachedData(cacheKey, results);
  return { results, fromCache: false, remainingDailyQuota: quota.remaining };
}

export async function getTripAdvisorReviews(
  locationId: string,
  limit: number = 5
): Promise<{ reviews: TripAdvisorReview[]; fromCache: boolean }> {
  validateRapidApiKey();

  const cacheKey = `tripadvisor_reviews_${locationId}_${limit}`;
  const cached = getCachedData<TripAdvisorReview[]>(cacheKey);
  if (cached) {
    return { reviews: cached, fromCache: true };
  }

  const quota = checkAndIncrementQuota('rapidapi');
  if (!quota.allowed) {
    throw new Error(`Limite diário de segurança da RapidAPI atingido (${quota.countToday} chamadas hoje). Protegendo o Free Tier.`);
  }

  const url = new URL(`https://${config.rapidApiTripAdvisorHost}/reviews/list`);
  url.searchParams.set('location_id', locationId);
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('currency', 'USD');
  url.searchParams.set('lang', 'pt_BR');

  const response = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key': config.rapidApiKey,
      'x-rapidapi-host': config.rapidApiTripAdvisorHost,
    },
  });

  if (!response.ok) {
    throw new Error(`RapidAPI TripAdvisor Reviews error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RapidReviewsResponse;
  const reviews = (data.data || []).map((review) => ({
    id: review.id || '',
    title: review.title || '',
    text: review.text || '',
    rating: review.rating || 0,
    publishedDate: review.published_date,
    author: review.user?.username,
  }));

  setCachedData(cacheKey, reviews);
  return { reviews, fromCache: false };
}
