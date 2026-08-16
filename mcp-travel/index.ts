import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  searchGooglePlaces,
  getGooglePlaceDetails,
  searchNearbyShopping,
} from './services/googlePlaces.js';
import {
  searchTripAdvisor,
  getTripAdvisorReviews,
} from './services/rapidTripAdvisor.js';

const server = new McpServer({
  name: 'travel-shopping-planner',
  version: '1.0.0',
});

// Tool 1: Google Places Search
server.tool(
  'search_places',
  'Search for locations, tourist spots, shops, restaurants, or malls using Google Places API',
  {
    query: z.string().describe('Search query (e.g., "shopping outlets in Miami", "romantic restaurants in Paris")'),
    lat: z.number().optional().describe('Optional latitude for location bias'),
    lng: z.number().optional().describe('Optional longitude for location bias'),
    radius: z.number().optional().describe('Search radius in meters (e.g. 5000)'),
    type: z.string().optional().describe('Optional place type (e.g. shopping_mall, restaurant, tourist_attraction)'),
  },
  async ({ query, lat, lng, radius, type }) => {
    try {
      const location = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
      const results = await searchGooglePlaces(query, { location, radius, type });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: results.length,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao buscar lugares no Google Places: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 2: Google Place Details
server.tool(
  'get_place_details',
  'Get comprehensive details for a specific place using Google Places place_id (reviews, opening hours, website, ratings, phone)',
  {
    placeId: z.string().describe('The Google place_id obtained from search_places'),
  },
  async ({ placeId }) => {
    try {
      const details = await getGooglePlaceDetails(placeId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(details, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao buscar detalhes do lugar: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 3: Nearby Shopping Search
server.tool(
  'search_nearby_shopping',
  'Find shopping malls, outlets, boutiques and markets near specific coordinates',
  {
    lat: z.number().describe('Latitude of the reference point'),
    lng: z.number().describe('Longitude of the reference point'),
    radiusMeters: z.number().optional().default(5000).describe('Radius in meters (default 5000)'),
    keyword: z.string().optional().describe('Optional keyword (e.g., "outlet", "luxury", "cosmetics", "vintage")'),
  },
  async ({ lat, lng, radiusMeters, keyword }) => {
    try {
      const results = await searchNearbyShopping(lat, lng, radiusMeters, keyword);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: results.length,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao buscar compras próximas: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 4: TripAdvisor Search via RapidAPI
server.tool(
  'tripadvisor_search',
  'Search TripAdvisor database via RapidAPI for destination guides, attractions, rankings and restaurants',
  {
    query: z.string().describe('Search query (e.g. "Paris shopping district", "Roma best sights")'),
    category: z
      .enum(['attractions', 'restaurants', 'hotels', 'geos'])
      .optional()
      .default('attractions')
      .describe('Category of interest'),
  },
  async ({ query, category }) => {
    try {
      const { results, fromCache, remainingDailyQuota } = await searchTripAdvisor(query, category);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: results.length,
                fromCache,
                remainingDailyQuota,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao buscar no TripAdvisor RapidAPI: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 5: TripAdvisor Reviews via RapidAPI
server.tool(
  'tripadvisor_reviews',
  'Get traveler reviews and ratings from TripAdvisor for a given locationId',
  {
    locationId: z.string().describe('The TripAdvisor locationId'),
    limit: z.number().optional().default(5).describe('Number of reviews to fetch (max 10)'),
  },
  async ({ locationId, limit }) => {
    try {
      const { reviews, fromCache } = await getTripAdvisorReviews(locationId, limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                count: reviews.length,
                fromCache,
                reviews,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao buscar reviews no TripAdvisor: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 6: Planner Especializado para Pedro & Gabriela
server.tool(
  'plan_trip_shopping',
  'Assist Pedro & Gabriela in curating shopping spots, dining, and activities for a target destination',
  {
    destination: z.string().describe('Target city or region (e.g., "Paris", "Nova York", "Santiago", "Milão")'),
    shoppingInterests: z
      .array(z.string())
      .optional()
      .describe('List of shopping categories (e.g. ["outlets", "cosméticos", "moda", "eletrônicos", "artesanato"])'),
    vibe: z
      .string()
      .optional()
      .describe('Trip style (e.g., "romântico", "gastronômico & compras", "cultural & passeios rápidos")'),
  },
  async ({ destination, shoppingInterests, vibe }) => {
    try {
      const interests = shoppingInterests && shoppingInterests.length > 0
        ? shoppingInterests
        : ['shopping malls', 'outlets', 'lojas locais e boutiques', 'feiras e souvenirs'];

      const queries = interests.map((cat) => `${cat} in ${destination}`);
      const searchPromises = queries.map((q) =>
        searchGooglePlaces(q).catch(() => [])
      );

      const placeResults = await Promise.all(searchPromises);
      const combinedPlaces = placeResults.flat();

      // Deduplicate by placeId
      const uniqueMap = new Map();
      for (const p of combinedPlaces) {
        if (!uniqueMap.has(p.placeId)) {
          uniqueMap.set(p.placeId, p);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                destination,
                travelers: 'Pedro & Gabriela',
                vibe: vibe || 'Viagem a dois + Roteiro de Compras Otimizado',
                categoriesSearched: interests,
                recommendedSpots: Array.from(uniqueMap.values()).slice(0, 15),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao planejar compras para ${destination}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Travel & Shopping Planner MCP Server rodando via STDIO');
}

run().catch((err) => {
  console.error('Erro fatal no servidor MCP:', err);
  process.exit(1);
});
