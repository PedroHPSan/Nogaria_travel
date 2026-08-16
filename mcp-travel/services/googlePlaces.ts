import { config, validateGoogleKey } from '../config.js';
import { getCachedData, setCachedData, checkAndIncrementQuota } from '../quotaGuard.js';
import type { PlaceSearchResult, PlaceDetailsResult, Coordinates } from '../types.js';

interface GoogleTextSearchResponse {
  status: string;
  results?: Array<{
    place_id: string;
    name: string;
    formatted_address?: string;
    vicinity?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    types?: string[];
    opening_hours?: {
      open_now?: boolean;
    };
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  }>;
  error_message?: string;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: {
    place_id: string;
    name: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    price_level?: number;
    opening_hours?: {
      open_now?: boolean;
      weekday_text?: string[];
    };
    reviews?: Array<{
      author_name: string;
      rating: number;
      text: string;
      relative_time_description: string;
    }>;
    url?: string;
  };
  error_message?: string;
}

export async function searchGooglePlaces(
  query: string,
  options: {
    location?: Coordinates;
    radius?: number;
    type?: string;
  } = {}
): Promise<PlaceSearchResult[]> {
  validateGoogleKey();

  const cacheKey = `google_search_${query.toLowerCase().trim()}_${options.location ? `${options.location.lat},${options.location.lng}` : ''}_${options.type || ''}`;
  const cached = getCachedData<PlaceSearchResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const quota = checkAndIncrementQuota('google');
  if (!quota.allowed) {
    throw new Error(quota.reason || 'Limite de segurança do Google Places Free Tier atingido.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('key', config.googlePlacesApiKey);

  if (options.location) {
    url.searchParams.set('location', `${options.location.lat},${options.location.lng}`);
  }
  if (options.radius) {
    url.searchParams.set('radius', options.radius.toString());
  }
  if (options.type) {
    url.searchParams.set('type', options.type);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GoogleTextSearchResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API returned status: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
  }

  const results = (data.results || []).map((item) => ({
    placeId: item.place_id,
    name: item.name,
    formattedAddress: item.formatted_address || item.vicinity || '',
    rating: item.rating,
    userRatingsTotal: item.user_ratings_total,
    priceLevel: item.price_level,
    types: item.types,
    isOpenNow: item.opening_hours?.open_now,
    location: item.geometry?.location
      ? { lat: item.geometry.location.lat, lng: item.geometry.location.lng }
      : undefined,
  }));

  setCachedData(cacheKey, results);
  return results;
}

export async function getGooglePlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  validateGoogleKey();

  const cacheKey = `google_details_${placeId}`;
  const cached = getCachedData<PlaceDetailsResult>(cacheKey);
  if (cached) {
    return cached;
  }

  const quota = checkAndIncrementQuota('google');
  if (!quota.allowed) {
    throw new Error(quota.reason || 'Limite de segurança do Google Places Free Tier atingido.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set(
    'fields',
    'place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,price_level,opening_hours,reviews,url'
  );
  url.searchParams.set('key', config.googlePlacesApiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Place Details API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GooglePlaceDetailsResponse;
  if (data.status !== 'OK' || !data.result) {
    throw new Error(`Google Place Details returned status: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
  }

  const item = data.result;
  const result: PlaceDetailsResult = {
    placeId: item.place_id,
    name: item.name,
    formattedAddress: item.formatted_address || '',
    formattedPhoneNumber: item.formatted_phone_number,
    website: item.website,
    rating: item.rating,
    userRatingsTotal: item.user_ratings_total,
    priceLevel: item.price_level,
    openingHours: item.opening_hours
      ? {
          openNow: item.opening_hours.open_now,
          weekdayText: item.opening_hours.weekday_text,
        }
      : undefined,
    reviews: item.reviews?.map((r) => ({
      authorName: r.author_name,
      rating: r.rating,
      text: r.text,
      relativeTimeDescription: r.relative_time_description,
    })),
    mapsUrl: item.url,
  };

  setCachedData(cacheKey, result);
  return result;
}

export async function searchNearbyShopping(
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
  keyword?: string
): Promise<PlaceSearchResult[]> {
  validateGoogleKey();

  const cacheKey = `google_nearby_${lat},${lng}_${radiusMeters}_${keyword || ''}`;
  const cached = getCachedData<PlaceSearchResult[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const quota = checkAndIncrementQuota('google');
  if (!quota.allowed) {
    throw new Error(quota.reason || 'Limite de segurança do Google Places Free Tier atingido.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', radiusMeters.toString());
  url.searchParams.set('type', 'shopping_mall');
  if (keyword) {
    url.searchParams.set('keyword', keyword);
  }
  url.searchParams.set('key', config.googlePlacesApiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Google Nearby Search error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GoogleTextSearchResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Nearby Search returned status: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
  }

  const results = (data.results || []).map((item) => ({
    placeId: item.place_id,
    name: item.name,
    formattedAddress: item.vicinity || item.formatted_address || '',
    rating: item.rating,
    userRatingsTotal: item.user_ratings_total,
    priceLevel: item.price_level,
    types: item.types,
    isOpenNow: item.opening_hours?.open_now,
    location: item.geometry?.location
      ? { lat: item.geometry.location.lat, lng: item.geometry.location.lng }
      : undefined,
  }));

  setCachedData(cacheKey, results);
  return results;
}
