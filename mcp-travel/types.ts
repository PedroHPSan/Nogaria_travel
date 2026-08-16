export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types?: string[];
  isOpenNow?: boolean;
  location?: Coordinates;
}

export interface PlaceDetailsResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  formattedPhoneNumber?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  openingHours?: {
    openNow?: boolean;
    weekdayText?: string[];
  };
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    relativeTimeDescription: string;
  }>;
  mapsUrl?: string;
}

export interface TripAdvisorSearchResult {
  locationId: string;
  name: string;
  address?: string;
  rating?: string;
  numReviews?: string;
  category?: string;
  ranking?: string;
  priceLevel?: string;
}

export interface TripAdvisorReview {
  id: string;
  title: string;
  text: string;
  rating: number;
  publishedDate?: string;
  author?: string;
}
