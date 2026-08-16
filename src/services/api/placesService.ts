export interface StorePlace {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  isOpenNow?: boolean;
  types?: string[];
  mapsUrl?: string;
  source: 'google' | 'tripadvisor' | 'cache';
}

export interface DiningPlace {
  placeId: string;
  name: string;
  address: string;
  cuisine: string;
  priceLevel: 1 | 2 | 3;
  priceEstimate: string; // Ex: "$ (US$ 8 - US$ 14 / pessoa)"
  kidFriendly: boolean;
  lactoseFreeFriendly: boolean;
  budgetSavingTip: string;
  rating?: number;
  userRatingsTotal?: number;
  isOpenNow?: boolean;
  mapsUrl?: string;
  source: 'google' | 'tripadvisor' | 'cache';
}

export interface HotelServicePlace {
  placeId: string;
  name: string;
  category: 'pharmacy' | 'supermarket' | 'gas_station' | 'urgent_care';
  categoryLabel: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  isOpenNow?: boolean;
  is24Hours?: boolean;
  urgencyTip: string;
  mapsUrl?: string;
  source: 'google' | 'cache';
}

export interface QuotaStatus {
  googleUsedToday: number;
  googleMaxDaily: number;
  rapidApiUsedToday: number;
  rapidApiMaxDaily: number;
  isCached: boolean;
}

const GOOGLE_MAX_DAILY = 50;
const RAPIDAPI_MAX_DAILY = 20;
const CACHE_KEY_PREFIX = 'nogaria_places_cache_';
const QUOTA_KEY = 'nogaria_api_quota_usage';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

interface StoredQuota {
  date: string;
  google: number;
  rapidapi: number;
}

export function getLocalQuotaStatus(): QuotaStatus {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    const today = getTodayString();
    if (raw) {
      const parsed: StoredQuota = JSON.parse(raw);
      if (parsed.date === today) {
        return {
          googleUsedToday: parsed.google,
          googleMaxDaily: GOOGLE_MAX_DAILY,
          rapidApiUsedToday: parsed.rapidapi,
          rapidApiMaxDaily: RAPIDAPI_MAX_DAILY,
          isCached: false,
        };
      }
    }
  } catch {
    // Ignore error
  }

  return {
    googleUsedToday: 0,
    googleMaxDaily: GOOGLE_MAX_DAILY,
    rapidApiUsedToday: 0,
    rapidApiMaxDaily: RAPIDAPI_MAX_DAILY,
    isCached: false,
  };
}

function incrementLocalQuota(service: 'google' | 'rapidapi'): boolean {
  const today = getTodayString();
  let current: StoredQuota = { date: today, google: 0, rapidapi: 0 };

  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (raw) {
      const parsed: StoredQuota = JSON.parse(raw);
      if (parsed.date === today) {
        current = parsed;
      }
    }
  } catch {
    // ignore
  }

  if (service === 'google') {
    if (current.google >= GOOGLE_MAX_DAILY) return false;
    current.google += 1;
  } else {
    if (current.rapidapi >= RAPIDAPI_MAX_DAILY) return false;
    current.rapidapi += 1;
  }

  localStorage.setItem(QUOTA_KEY, JSON.stringify(current));
  return true;
}

export async function searchStores(
  query: string,
  destination: string = 'Orlando, FL'
): Promise<{ places: StorePlace[]; fromCache: boolean; quota: QuotaStatus }> {
  const fullQuery = `${query} ${destination}`.trim();
  const cacheKey = `${CACHE_KEY_PREFIX}${fullQuery.toLowerCase().replace(/\s+/g, '_')}`;

  // 1. Check browser cache (3 days TTL)
  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      const isStillFresh = Date.now() - timestamp < 1000 * 60 * 60 * 24 * 3;
      if (isStillFresh && Array.isArray(data)) {
        return {
          places: data,
          fromCache: true,
          quota: { ...getLocalQuotaStatus(), isCached: true },
        };
      }
    }
  } catch {
    // ignore cache read errors
  }

  // 2. Fetch using Google Places API
  const googleApiKey =
    import.meta.env.VITE_GOOGLE_PLACES_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GOOGLE_PLACES_API_KEY : '') ||
    '';

  if (!googleApiKey) {
    // Fallback offline curated data if no API key is set in frontend
    return {
      places: getCuratedFallbackStores(query, destination),
      fromCache: true,
      quota: { ...getLocalQuotaStatus(), isCached: true },
    };
  }

  // Check quota safety
  const allowed = incrementLocalQuota('google');
  if (!allowed) {
    throw new Error('Limite diário de segurança do Free Tier do Google atingido (50 consultas hoje). Protegendo custos!');
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', fullQuery);
    url.searchParams.set('key', googleApiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google API status: ${res.status}`);

    const json = await res.json();
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      throw new Error(json.error_message || `Status Google: ${json.status}`);
    }

    const places: StorePlace[] = (json.results || []).slice(0, 10).map((r: any) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || r.vicinity || '',
      rating: r.rating,
      userRatingsTotal: r.user_ratings_total,
      isOpenNow: r.opening_hours?.open_now,
      types: r.types,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id}`,
      source: 'google',
    }));

    // Cache results
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        data: places,
      })
    );

    return {
      places,
      fromCache: false,
      quota: getLocalQuotaStatus(),
    };
  } catch {
    // Fallback gracefully on network / CORS / Quota errors
    const fallback = getCuratedFallbackStores(query, destination);
    return {
      places: fallback,
      fromCache: true,
      quota: { ...getLocalQuotaStatus(), isCached: true },
    };
  }
}

function getCuratedFallbackStores(query: string, destination: string): StorePlace[] {
  const q = query.toLowerCase();
  const d = destination.toLowerCase();

  if (q.includes('apple') || q.includes('macbook') || q.includes('iphone')) {
    if (d.includes('miami') || d.includes('aventura')) {
      return [
        {
          placeId: 'apple_aventura',
          name: 'Apple Aventura',
          address: '19501 Biscayne Blvd, Aventura, FL 33180',
          rating: 4.7,
          userRatingsTotal: 3420,
          isOpenNow: true,
          mapsUrl: 'https://maps.google.com/?q=Apple+Aventura+Miami',
          source: 'cache',
        },
        {
          placeId: 'apple_brickell',
          name: 'Apple Brickell City Centre',
          address: '701 S Miami Ave, Miami, FL 33130',
          rating: 4.6,
          userRatingsTotal: 1850,
          isOpenNow: true,
          mapsUrl: 'https://maps.google.com/?q=Apple+Brickell+Miami',
          source: 'cache',
        },
      ];
    }
    return [
      {
        placeId: 'apple_millenia',
        name: 'Apple The Mall at Millenia',
        address: '4200 Conroy Rd, Orlando, FL 32839',
        rating: 4.6,
        userRatingsTotal: 4120,
        isOpenNow: true,
        mapsUrl: 'https://maps.google.com/?q=Apple+Mall+at+Millenia+Orlando',
        source: 'cache',
      },
      {
        placeId: 'apple_florida_mall',
        name: 'Apple The Florida Mall',
        address: '8001 S Orange Blossom Trl, Orlando, FL 32809',
        rating: 4.5,
        userRatingsTotal: 2980,
        isOpenNow: true,
        mapsUrl: 'https://maps.google.com/?q=Apple+Florida+Mall',
        source: 'cache',
      },
    ];
  }

  if (q.includes('carter') || q.includes('infantil') || q.includes('roupa')) {
    return [
      {
        placeId: 'carters_sawgrass',
        name: "Carter's - Sawgrass Mills Outlet",
        address: '12801 W Sunrise Blvd Ste 815, Sunrise, FL 33323',
        rating: 4.5,
        userRatingsTotal: 840,
        isOpenNow: true,
        mapsUrl: 'https://maps.google.com/?q=Carters+Sawgrass+Mills',
        source: 'cache',
      },
      {
        placeId: 'carters_vineland',
        name: "Carter's - Orlando Premium Outlets Vineland",
        address: '8200 Vineland Ave Space 1112, Orlando, FL 32821',
        rating: 4.5,
        userRatingsTotal: 620,
        isOpenNow: true,
        mapsUrl: 'https://maps.google.com/?q=Carters+Vineland+Orlando',
        source: 'cache',
      },
    ];
  }

  return [
    {
      placeId: 'sawgrass_mills',
      name: 'Sawgrass Mills Outlet (Simon Center)',
      address: '12801 W Sunrise Blvd, Sunrise, FL 33323',
      rating: 4.5,
      userRatingsTotal: 48900,
      isOpenNow: true,
      mapsUrl: 'https://maps.google.com/?q=Sawgrass+Mills+Sunrise',
      source: 'cache',
    },
    {
      placeId: 'bestbuy_millenia',
      name: 'Best Buy Millenia Orlando',
      address: '4155 Millenia Blvd, Orlando, FL 32839',
      rating: 4.3,
      userRatingsTotal: 3200,
      isOpenNow: true,
      mapsUrl: 'https://maps.google.com/?q=Best+Buy+Millenia+Orlando',
      source: 'cache',
    },
    {
      placeId: 'target_kissimmee',
      name: 'Super Target Rolling Oaks (Kissimmee)',
      address: '3200 Rolling Oaks Blvd, Kissimmee, FL 34747',
      rating: 4.4,
      userRatingsTotal: 3890,
      isOpenNow: true,
      mapsUrl: 'https://maps.google.com/?q=Super+Target+Rolling+Oaks+Kissimmee',
      source: 'cache',
    },
  ];
}

export async function searchBudgetDining(
  destination: string = 'Orlando / Kissimmee',
  maxPriceLevel: 1 | 2 = 1,
  category: 'all' | 'fast_casual' | 'family_buffet' | 'healthy_cheap' | 'grab_and_go' = 'all'
): Promise<{ places: DiningPlace[]; fromCache: boolean; quota: QuotaStatus }> {
  const cacheKey = `${CACHE_KEY_PREFIX}dining_${destination.toLowerCase().replace(/\s+/g, '_')}_p${maxPriceLevel}_${category}`;

  // 1. Check local cache
  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      const isStillFresh = Date.now() - timestamp < 1000 * 60 * 60 * 24 * 3;
      if (isStillFresh && Array.isArray(data)) {
        return {
          places: data,
          fromCache: true,
          quota: { ...getLocalQuotaStatus(), isCached: true },
        };
      }
    }
  } catch {
    // ignore
  }

  // 2. Fetch using Google Places API if key available, or fallback to specialized curated budget options
  const googleApiKey =
    import.meta.env.VITE_GOOGLE_PLACES_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GOOGLE_PLACES_API_KEY : '') ||
    '';

  if (!googleApiKey) {
    const curated = getCuratedBudgetDining(destination, maxPriceLevel, category);
    return {
      places: curated,
      fromCache: true,
      quota: { ...getLocalQuotaStatus(), isCached: true },
    };
  }

  // Check quota
  const allowed = incrementLocalQuota('google');
  if (!allowed) {
    throw new Error('Limite de segurança diário do Google Places atingido (50 consultas hoje).');
  }

  try {
    const queryTerm = maxPriceLevel === 1 ? 'cheap eats affordable restaurants fast casual' : 'restaurants budget friendly';
    const fullQuery = `${queryTerm} in ${destination}`;

    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', fullQuery);
    url.searchParams.set('type', 'restaurant');
    url.searchParams.set('maxprice', String(maxPriceLevel));
    url.searchParams.set('key', googleApiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google API status: ${res.status}`);

    const json = await res.json();
    const results: any[] = json.results || [];

    const places: DiningPlace[] = results.slice(0, 10).map((r) => {
      const pLevel = (r.price_level === 1 ? 1 : r.price_level === 2 ? 2 : 1) as 1 | 2;
      return {
        placeId: r.place_id,
        name: r.name,
        address: r.formatted_address || r.vicinity || '',
        cuisine: r.types?.filter((t: string) => t !== 'restaurant' && t !== 'food' && t !== 'point_of_interest').join(', ') || 'Culinária Variada',
        priceLevel: pLevel,
        priceEstimate: pLevel === 1 ? '$ (US$ 8 - US$ 14 / pessoa)' : '$$ (US$ 15 - US$ 25 / pessoa)',
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        isOpenNow: r.opening_hours?.open_now,
        kidFriendly: true,
        lactoseFreeFriendly: true,
        budgetSavingTip: 'Pratos fartos e opções de combos individuais com refil.',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id}`,
        source: 'google',
      };
    });

    // Save cache
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        data: places,
      })
    );

    return {
      places: places.length > 0 ? places : getCuratedBudgetDining(destination, maxPriceLevel, category),
      fromCache: false,
      quota: getLocalQuotaStatus(),
    };
  } catch {
    const fallback = getCuratedBudgetDining(destination, maxPriceLevel, category);
    return {
      places: fallback,
      fromCache: true,
      quota: { ...getLocalQuotaStatus(), isCached: true },
    };
  }
}

function getCuratedBudgetDining(
  destination: string,
  maxPriceLevel: 1 | 2 = 1,
  _category: string = 'all'
): DiningPlace[] {
  const isMiami = destination.toLowerCase().includes('miami');

  const orlandoList: DiningPlace[] = [
    {
      placeId: 'chipotle_kissimmee',
      name: 'Chipotle Mexican Grill (US-192 Kissimmee)',
      address: '7818 W Irlo Bronson Memorial Hwy, Kissimmee, FL',
      cuisine: 'Mexicana Fast-Casual (Bowls & Burritos)',
      priceLevel: 1,
      priceEstimate: '$ (US$ 9 - US$ 13 / pessoa)',
      rating: 4.4,
      userRatingsTotal: 2150,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'Tigelas (Bowls) enormes com arroz, feijão, frango e guacamole. Dá para dividir ou pedir tortillas extras por centavos.',
      mapsUrl: 'https://maps.google.com/?q=Chipotle+7818+W+Irlo+Bronson+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'panda_express_disney',
      name: 'Panda Express (Rolling Oaks / Kissimmee)',
      address: '3210 Rolling Oaks Blvd, Kissimmee, FL 34747',
      cuisine: 'Chinesa Rápida (Orange Chicken & Fried Rice)',
      priceLevel: 1,
      priceEstimate: '$ (US$ 8 - US$ 11 / pessoa)',
      rating: 4.3,
      userRatingsTotal: 1890,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'O Combo "Bigger Plate" (1 base + 3 carnes) por ~US$ 11 alimenta muito bem duas pessoas.',
      mapsUrl: 'https://maps.google.com/?q=Panda+Express+Rolling+Oaks+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'cicis_pizza_kissimmee',
      name: "Cicis Pizza All-You-Can-Eat Buffet",
      address: '5033 W Irlo Bronson Memorial Hwy, Kissimmee, FL',
      cuisine: 'Pizzas, Massas, Saladas & Sobremesas (Buffet Livre)',
      priceLevel: 1,
      priceEstimate: '$ (US$ 10 / adulto, US$ 6 / criança)',
      rating: 4.2,
      userRatingsTotal: 3400,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: false,
      budgetSavingTip: 'Buffet livre de pizzas doces/salgadas, saladas e sobremesa. Uma das opções mais baratas para famílias em Orlando.',
      mapsUrl: 'https://maps.google.com/?q=Cicis+Pizza+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'chickfila_vineland',
      name: 'Chick-fil-A (Vineland / Lake Buena Vista)',
      address: '13448 State Road 535, Orlando, FL 32821',
      cuisine: 'Frango Empanado, Sanduíches & Batata Waffle',
      priceLevel: 1,
      priceEstimate: '$ (US$ 7 - US$ 10 / pessoa)',
      rating: 4.6,
      userRatingsTotal: 5120,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'Qualidade premium de atendimento, nuggets assados para crianças e molhos gratuitos à vontade.',
      mapsUrl: 'https://maps.google.com/?q=Chick-fil-A+Lake+Buena+Vista+Orlando',
      source: 'cache',
    },
    {
      placeId: 'target_deli_kissimmee',
      name: 'Super Target Deli & Bakery (Grab & Go)',
      address: '3200 Rolling Oaks Blvd, Kissimmee, FL 34747',
      cuisine: 'Frango Assado Inteiro, Sanduíches e Frutas Prontas',
      priceLevel: 1,
      priceEstimate: '$ (US$ 4 - US$ 7 / pessoa)',
      rating: 4.5,
      userRatingsTotal: 3890,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'Frango assado inteiro pronto (Rotisserie Chicken) por US$ 8 + pacote de pães e salada alimenta a família inteira por menos de US$ 15!',
      mapsUrl: 'https://maps.google.com/?q=Super+Target+Rolling+Oaks+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'olive_garden_kissimmee',
      name: 'Olive Garden Italian Restaurant (US-192)',
      address: '5021 W Irlo Bronson Memorial Hwy, Kissimmee, FL',
      cuisine: 'Italiana (Sopas, Saladas e Pães Ilimitados)',
      priceLevel: 2,
      priceEstimate: '$$ (US$ 14 - US$ 18 / pessoa)',
      rating: 4.5,
      userRatingsTotal: 6200,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'O combo "Unlimited Soup, Salad & Breadsticks" custa ~US$ 12 no almoço com reposição infinita de salada fresca e pães quentinhos.',
      mapsUrl: 'https://maps.google.com/?q=Olive+Garden+Kissimmee+192',
      source: 'cache',
    },
  ];

  const miamiList: DiningPlace[] = [
    {
      placeId: 'chipotle_south_beach',
      name: 'Chipotle Mexican Grill (South Beach)',
      address: '601 Washington Ave, Miami Beach, FL 33139',
      cuisine: 'Mexicana Fast-Casual (Bowls & Tacos)',
      priceLevel: 1,
      priceEstimate: '$ (US$ 10 - US$ 14 / pessoa)',
      rating: 4.3,
      userRatingsTotal: 1780,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'Opção excelente para comer barato a poucos quarteirões da praia em Miami Beach.',
      mapsUrl: 'https://maps.google.com/?q=Chipotle+Washington+Ave+Miami+Beach',
      source: 'cache',
    },
    {
      placeId: 'five_guys_south_beach',
      name: 'Five Guys (Burgers & Fresh Fries)',
      address: '1500 Washington Ave, Miami Beach, FL 33139',
      cuisine: 'Hambúrgueres Artesanais & Batata Frita Farta',
      priceLevel: 1,
      priceEstimate: '$ (US$ 10 - US$ 14 / pessoa)',
      rating: 4.4,
      userRatingsTotal: 2900,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'A porção de batata frita "Little Fries" vem transbordando no saco e é suficiente para 2 ou 3 pessoas dividirem.',
      mapsUrl: 'https://maps.google.com/?q=Five+Guys+Washington+Ave+Miami+Beach',
      source: 'cache',
    },
    {
      placeId: 'polla_tropical_sawgrass',
      name: 'Pollo Tropical (Sawgrass Mills Area)',
      address: '13700 W Sunrise Blvd, Sunrise, FL 33323',
      cuisine: 'Caribenha / Frango Grelhado, Arroz, Feijão Preto e Mandioca',
      priceLevel: 1,
      priceEstimate: '$ (US$ 8 - US$ 12 / pessoa)',
      rating: 4.3,
      userRatingsTotal: 1450,
      isOpenNow: true,
      kidFriendly: true,
      lactoseFreeFriendly: true,
      budgetSavingTip: 'Comida muito parecida com a brasileira (arroz, feijão preto e frango grelhado), super saudável, rápida e barata.',
      mapsUrl: 'https://maps.google.com/?q=Pollo+Tropical+Sawgrass+Sunrise',
      source: 'cache',
    },
  ];

  const fullList = isMiami ? miamiList : orlandoList;
  return fullList.filter((p) => (maxPriceLevel === 1 ? p.priceLevel === 1 : true));
}

export async function searchHotelServices(
  destination: string = 'Orlando / Kissimmee',
  categoryFilter: 'all' | 'pharmacy' | 'supermarket' | 'gas_station' = 'all'
): Promise<{ places: HotelServicePlace[]; fromCache: boolean; quota: QuotaStatus }> {
  const cacheKey = `${CACHE_KEY_PREFIX}services_${destination.toLowerCase().replace(/\s+/g, '_')}_${categoryFilter}`;

  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      const isStillFresh = Date.now() - timestamp < 1000 * 60 * 60 * 24 * 3;
      if (isStillFresh && Array.isArray(data)) {
        return {
          places: data,
          fromCache: true,
          quota: { ...getLocalQuotaStatus(), isCached: true },
        };
      }
    }
  } catch {
    // ignore
  }

  const googleApiKey =
    import.meta.env.VITE_GOOGLE_PLACES_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GOOGLE_PLACES_API_KEY : '') ||
    '';

  if (!googleApiKey) {
    const fallback = getCuratedHotelServices(destination, categoryFilter);
    return {
      places: fallback,
      fromCache: true,
      quota: { ...getLocalQuotaStatus(), isCached: true },
    };
  }

  const allowed = incrementLocalQuota('google');
  if (!allowed) {
    throw new Error('Limite de segurança diário do Google Places atingido (50 consultas hoje).');
  }

  try {
    const queryTerm =
      categoryFilter === 'pharmacy'
        ? 'walgreens cvs pharmacy 24 hours'
        : categoryFilter === 'supermarket'
        ? 'target walmart supermarket groceries'
        : categoryFilter === 'gas_station'
        ? 'wawa gas station convenience'
        : 'pharmacy supermarket target walgreens';

    const fullQuery = `${queryTerm} in ${destination}`;
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', fullQuery);
    url.searchParams.set('key', googleApiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Google API status: ${res.status}`);

    const json = await res.json();
    const results: any[] = json.results || [];

    const places: HotelServicePlace[] = results.slice(0, 10).map((r) => {
      const isPharm = r.name.toLowerCase().includes('walgreens') || r.name.toLowerCase().includes('cvs') || r.name.toLowerCase().includes('pharmacy');
      const isMarket = r.name.toLowerCase().includes('target') || r.name.toLowerCase().includes('walmart') || r.name.toLowerCase().includes('publix');
      const cat: HotelServicePlace['category'] = isPharm ? 'pharmacy' : isMarket ? 'supermarket' : 'gas_station';

      return {
        placeId: r.place_id,
        name: r.name,
        category: cat,
        categoryLabel: isPharm ? '💊 Farmácia & Saúde' : isMarket ? '🛒 Supermercado & Snacks' : '⛽ Posto & Conveniência',
        address: r.formatted_address || r.vicinity || '',
        rating: r.rating,
        userRatingsTotal: r.user_ratings_total,
        isOpenNow: r.opening_hours?.open_now,
        is24Hours: r.name.toLowerCase().includes('24') || isPharm,
        urgencyTip: isPharm ? 'Medicamentos infantis, termômetro, curativos e primeiros socorros.' : 'Água mineral, frutas, fraldas, snacks e carrinho guarda-chuva.',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.place_id}`,
        source: 'google',
      };
    });

    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        data: places,
      })
    );

    return {
      places: places.length > 0 ? places : getCuratedHotelServices(destination, categoryFilter),
      fromCache: false,
      quota: getLocalQuotaStatus(),
    };
  } catch {
    const fallback = getCuratedHotelServices(destination, categoryFilter);
    return {
      places: fallback,
      fromCache: true,
      quota: { ...getLocalQuotaStatus(), isCached: true },
    };
  }
}

function getCuratedHotelServices(
  destination: string,
  categoryFilter: string = 'all'
): HotelServicePlace[] {
  const isMiami = destination.toLowerCase().includes('miami');

  const orlandoServices: HotelServicePlace[] = [
    {
      placeId: 'target_kissimmee_rolling_oaks',
      name: 'Super Target (Rolling Oaks Kissimmee)',
      category: 'supermarket',
      categoryLabel: '🛒 Supermercado Principal',
      address: '3200 Rolling Oaks Blvd, Kissimmee, FL 34747',
      rating: 4.4,
      userRatingsTotal: 3890,
      isOpenNow: true,
      is24Hours: false,
      urgencyTip: 'A 5 min do Celebration Suites. Local ideal para comprar o carrinho da Gabriela, água, lanches e protetor solar.',
      mapsUrl: 'https://maps.google.com/?q=Super+Target+Rolling+Oaks+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'walgreens_24h_kissimmee',
      name: 'Walgreens 24h Pharmacy (US-192 Kissimmee)',
      category: 'pharmacy',
      categoryLabel: '💊 Farmácia 24h',
      address: '7767 W Irlo Bronson Memorial Hwy, Kissimmee, FL',
      rating: 4.3,
      userRatingsTotal: 1240,
      isOpenNow: true,
      is24Hours: true,
      urgencyTip: 'Farmácia 24 horas aberta de madrugada para qualquer imprevisto médico, remédios febris ou curativos.',
      mapsUrl: 'https://maps.google.com/?q=Walgreens+7767+W+Irlo+Bronson+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'walmart_supercenter_kissimmee',
      name: 'Walmart Supercenter (Vineland Rd / US-192)',
      category: 'supermarket',
      categoryLabel: '🛒 Hipermercado 24h',
      address: '4444 W Vine St, Kissimmee, FL 34746',
      rating: 4.2,
      userRatingsTotal: 11200,
      isOpenNow: true,
      is24Hours: true,
      urgencyTip: 'Maior variedade com preços mais baixos de água, malas extras, souvenirs baratos da Disney e cosméticos.',
      mapsUrl: 'https://maps.google.com/?q=Walmart+Supercenter+4444+W+Vine+St+Kissimmee',
      source: 'cache',
    },
    {
      placeId: 'wawa_gas_kissimmee',
      name: 'Wawa Gas Station & 24h Food Market',
      category: 'gas_station',
      categoryLabel: '⛽ Posto & Café 24h',
      address: '7940 W Irlo Bronson Memorial Hwy, Kissimmee, FL',
      rating: 4.5,
      userRatingsTotal: 1890,
      isOpenNow: true,
      is24Hours: true,
      urgencyTip: 'Combustível mais barato da região, café da manhã rápido, sanduíches frescos feitos na hora e gelo para coolers.',
      mapsUrl: 'https://maps.google.com/?q=Wawa+7940+W+Irlo+Bronson+Kissimmee',
      source: 'cache',
    },
  ];

  const miamiServices: HotelServicePlace[] = [
    {
      placeId: 'walgreens_collins_miami',
      name: 'Walgreens Pharmacy (Collins Ave Miami Beach)',
      category: 'pharmacy',
      categoryLabel: '💊 Farmácia & Conveniência',
      address: '4049 Pine Tree Dr / Collins Ave, Miami Beach, FL',
      rating: 4.2,
      userRatingsTotal: 1450,
      isOpenNow: true,
      is24Hours: true,
      urgencyTip: 'A 4 quarteirões da Casa Faena. Água mineral gelada, protetor solar e itens de praia a preço de farmácia.',
      mapsUrl: 'https://maps.google.com/?q=Walgreens+Collins+Ave+Miami+Beach',
      source: 'cache',
    },
    {
      placeId: 'whole_foods_south_beach',
      name: 'Whole Foods Market (South Beach)',
      category: 'supermarket',
      categoryLabel: '🛒 Mercado Orgânico & Buffet',
      address: '1020 Alton Rd, Miami Beach, FL 33139',
      rating: 4.5,
      userRatingsTotal: 4100,
      isOpenNow: true,
      is24Hours: false,
      urgencyTip: 'Frutas frescas fatiadas, sucos naturais e buffet quente por peso para refeições rápidas e saudáveis.',
      mapsUrl: 'https://maps.google.com/?q=Whole+Foods+1020+Alton+Rd+Miami+Beach',
      source: 'cache',
    },
    {
      placeId: 'speedway_fll_airport',
      name: 'Speedway Gas Station (FLL Airport Support)',
      category: 'gas_station',
      categoryLabel: '⛽ Posto Devolução Minivan',
      address: '2400 W State Rd 84, Fort Lauderdale, FL 33312',
      rating: 4.3,
      userRatingsTotal: 820,
      isOpenNow: true,
      is24Hours: true,
      urgencyTip: 'Ao lado do hotel Rodeway / Four Points. Abasteça o tanque da Chrysler Pacifica aqui antes da devolução na Dollar para evitar taxa abusiva da locadora.',
      mapsUrl: 'https://maps.google.com/?q=Speedway+2400+W+State+Rd+84+Fort+Lauderdale',
      source: 'cache',
    },
  ];

  const fullList = isMiami ? miamiServices : orlandoServices;
  if (categoryFilter === 'all') return fullList;
  return fullList.filter((s) => s.category === categoryFilter);
}


