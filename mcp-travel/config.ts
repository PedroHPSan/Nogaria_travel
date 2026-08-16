import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // Also check current working directory

export const config = {
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY || '',
  rapidApiKey: process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY || '',
  rapidApiTripAdvisorHost: process.env.RAPIDAPI_TRIPADVISOR_HOST || 'travel-advisor.p.rapidapi.com',
};

export function validateGoogleKey(): void {
  if (!config.googlePlacesApiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured in .env. Please set GOOGLE_PLACES_API_KEY.');
  }
}

export function validateRapidApiKey(): void {
  if (!config.rapidApiKey) {
    throw new Error('RAPIDAPI_KEY is not configured in .env. Please set RAPIDAPI_KEY.');
  }
}
