import { searchGooglePlaces, getGooglePlaceDetails } from '../mcp-travel/services/googlePlaces.js';
import { searchTripAdvisor } from '../mcp-travel/services/rapidTripAdvisor.js';

async function runResearch() {
  console.log('=== 1. Pesquisa de Eletrônicos (Pedro) ===');
  const bestBuyOrlando = await searchGooglePlaces('Best Buy Millenia Orlando');
  const appleAventura = await searchGooglePlaces('Apple Store Aventura Mall Miami');
  const bestBuySawgrass = await searchGooglePlaces('Best Buy Sawgrass Sunrise');
  
  console.log('Best Buy Millenia:', bestBuyOrlando[0]?.name, '|', bestBuyOrlando[0]?.formattedAddress, '| Rating:', bestBuyOrlando[0]?.rating);
  console.log('Apple Aventura:', appleAventura[0]?.name, '|', appleAventura[0]?.formattedAddress, '| Rating:', appleAventura[0]?.rating);
  console.log('Best Buy Sawgrass:', bestBuySawgrass[0]?.name, '|', bestBuySawgrass[0]?.formattedAddress, '| Rating:', bestBuySawgrass[0]?.rating);

  console.log('\n=== 2. Pesquisa de Roupas Infantis e Adulto (Gabriela 4 anos & Pedro) ===');
  const cartersSawgrass = await searchGooglePlaces('Carters Sawgrass Mills');
  const cartersVineland = await searchGooglePlaces('Carters Orlando Premium Outlets Vineland');
  const targetKissimmee = await searchGooglePlaces('Super Target Rolling Oaks Blvd Kissimmee');
  
  console.log('Carters Sawgrass:', cartersSawgrass[0]?.name, '|', cartersSawgrass[0]?.formattedAddress, '| Rating:', cartersSawgrass[0]?.rating);
  console.log('Carters Vineland:', cartersVineland[0]?.name, '|', cartersVineland[0]?.formattedAddress, '| Rating:', cartersVineland[0]?.rating);
  console.log('Super Target Kissimmee:', targetKissimmee[0]?.name, '|', targetKissimmee[0]?.formattedAddress, '| Rating:', targetKissimmee[0]?.rating);

  console.log('\n=== 3. Pesquisa de Brinquedos e Experiências (Gabriela 4 anos) ===');
  const worldOfDisney = await searchGooglePlaces('World of Disney Disney Springs');
  const legoStoreSprings = await searchGooglePlaces('LEGO Store Disney Springs');
  const buildABear = await searchGooglePlaces('Build-A-Bear Workshop Florida Mall Orlando');
  
  console.log('World of Disney:', worldOfDisney[0]?.name, '|', worldOfDisney[0]?.formattedAddress, '| Rating:', worldOfDisney[0]?.rating);
  console.log('LEGO Store:', legoStoreSprings[0]?.name, '|', legoStoreSprings[0]?.formattedAddress, '| Rating:', legoStoreSprings[0]?.rating);
  console.log('Build-A-Bear:', buildABear[0]?.name, '|', buildABear[0]?.formattedAddress, '| Rating:', buildABear[0]?.rating);

  console.log('\n=== 4. TripAdvisor RapidAPI ===');
  const tripAdvisorSawgrass = await searchTripAdvisor('Sawgrass Mills', 'attractions');
  console.log('TripAdvisor Sawgrass:', tripAdvisorSawgrass.results[0]?.name, '| Rating:', tripAdvisorSawgrass.results[0]?.rating, '| Reviews:', tripAdvisorSawgrass.results[0]?.numReviews);
  
  const tripAdvisorSprings = await searchTripAdvisor('Disney Springs', 'attractions');
  console.log('TripAdvisor Disney Springs:', tripAdvisorSprings.results[0]?.name, '| Rating:', tripAdvisorSprings.results[0]?.rating, '| Reviews:', tripAdvisorSprings.results[0]?.numReviews);
}

runResearch().catch(console.error);
