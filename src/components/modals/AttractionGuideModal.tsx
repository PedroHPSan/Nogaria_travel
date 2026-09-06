import React from 'react';
import { BaseModal } from './BaseModal';
import type { ItineraryItem } from '../../types/database.types';
import {
  MapPin,
  ExternalLink,
  Baby,
  Utensils,
  Lightbulb,
  Sparkles
} from 'lucide-react';

interface AttractionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItineraryItem | null;
}

export const AttractionGuideModal: React.FC<AttractionGuideModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  if (!item) return null;

  const getParkInsights = (title: string, category: string) => {
    const t = title.toLowerCase();

    if (t.includes('magic kingdom')) {
      return {
        strategy: 'Chegar no Rope Drop (30 min antes da abertura oficial). Iniciar pela Fantasyland (Peter Pan, Dumbo, Carrossel) que a Gabriela (4a) vai amar antes do calor do meio-dia.',
        heightAlert: 'Space Mountain (112cm), Big Thunder Mountain (102cm), Tron (122cm), Seven Dwarfs (97cm - Gabi pode!). Ativar Rider Switch para as mais radicais.',
        diningTip: 'Pedir copos de água com gelo GRÁTIS em qualquer balcão Quick Service (ex: Cosmic Ray\'s ou Pecos Bill). Levar snacks na mochila da Gabi.',
        restSpot: 'Mickey\'s PhilharMagic e PeopleMover são atrações sentadas no ar-condicionado perfeitas para a pausa da tarde da Gabriela.',
        mapsSearch: 'Magic Kingdom Park Walt Disney World Orlando',
      };
    }

    if (t.includes('epcot')) {
      return {
        strategy: 'Priorizar Remy’s Ratatouille Adventure e Frozen Ever After cedo (ambas sem restrição de altura e perfeitas para Gabi e família).',
        heightAlert: 'Guardians of the Galaxy: Cosmic Rewind (107cm), Test Track (102cm), Mission: SPACE (102cm).',
        diningTip: 'Sunshine Seasons (The Land) oferece refeições completas e econômicas com opções sem lactose para Débora.',
        restSpot: 'The Seas with Nemo & Friends tem um aquário gigante climatizado excelente para descanso infantil.',
        mapsSearch: 'EPCOT Walt Disney World Resort',
      };
    }

    if (t.includes('hollywood') || t.includes('studios')) {
      return {
        strategy: 'Visitar Toy Story Land logo cedo (Slinky Dog Dash e Toy Story Mania). Assistir aos shows Beauty and the Beast e Frozen Sing-Along à tarde.',
        heightAlert: 'Tower of Terror (102cm), Rock \'n\' Roller Coaster (122cm), Rise of the Resistance (102cm), Millennium Falcon (97cm).',
        diningTip: 'Woody\'s Lunch Box tem combos de sanduíches acessíveis. Levar frutas e biscoitos.',
        restSpot: 'Show do Frozen e Disney Junior Play & Dance no ar-condicionado.',
        mapsSearch: 'Disney Hollywood Studios Orlando',
      };
    }

    if (t.includes('animal kingdom')) {
      return {
        strategy: 'Fazer o Safari (Kilimanjaro Safaris) na primeira hora quando os animais estão mais ativos. Assistir ao Festival of the Lion King.',
        heightAlert: 'Flight of Passage (112cm), Expedition Everest (112cm), DINOSAUR (102cm). Na\'vi River Journey não tem restrição de altura!',
        diningTip: 'Flame Tree Barbecue e Satu\'li Canteen oferecem porções fartas com excelente custo-benefício.',
        restSpot: 'Boneyard Play Area (playground para a Gabriela gastar energia e relaxar).',
        mapsSearch: 'Disney Animal Kingdom Theme Park',
      };
    }

    if (t.includes('universal') || t.includes('islands') || t.includes('adventure')) {
      return {
        strategy: 'Universal Studios: Foco em Minions e Harry Potter Diagon Alley. Islands: Seuss Landing é a área 100% infantil ideal para a Gabriela.',
        heightAlert: 'Velocicoaster (130cm), Hulk (137cm), Hagrid (122cm). Débora vai adorar, e Pedro/Bárbara podem usar o Child Swap.',
        diningTip: 'Louie\'s Italian Restaurant ou Circus McGurkus Cafe Stoo-pendous para refeições rápidas e econômicas.',
        restSpot: 'Seuss Landing com carrossel e trenzinho suspenso para a Gabi.',
        mapsSearch: 'Universal Orlando Resort',
      };
    }

    if (t.includes('sawgrass') || category === 'shopping') {
      return {
        strategy: 'Sawgrass Mills é gigantesco (maior outlet dos EUA). Alugar carrinho estilo carrinho de corrida no local para a Gabriela não se cansar.',
        heightAlert: 'Nenhuma restrição. Dividir as paradas: Pedro na Apple/Eletrônicos, Bárbara na Carter\'s/Moda e Débora nas lojas teen.',
        diningTip: 'Pollo Tropical ou praça de alimentação principal com combos baratos de almoço.',
        restSpot: 'Starbucks ou praça central climatizada para revezamento com as meninas.',
        mapsSearch: `${item.title} ${item.city || 'Orlando'}`,
      };
    }

    return {
      strategy: `Chegar 15 minutos antes do horário planejado (${item.time_start || '09:00'}) para estacionar e validar ingressos sem fila.`,
      heightAlert: item.min_height_cm ? `Exige altura mínima de ${item.min_height_cm}cm.` : 'Livre para todas as idades (Gabriela 4a liberada).',
      diningTip: 'Consulte os restaurantes econômicos próximos com o botão Comer Barato no sistema.',
      restSpot: 'Manter água gelada sempre à mão e fazer pausas à sombra a cada 2 horas.',
      mapsSearch: `${item.title} ${item.city || 'Orlando, FL'}`,
    };
  };

  const insights = getParkInsights(item.title, item.category);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(insights.mapsSearch)}`;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Guia & Dicas Estratégicas: ${item.title}`}
      subtitle={`${item.category.toUpperCase()} • ${item.city} • Horário: ${item.time_start || 'A combinar'}`}
    >
      <div className="space-y-4 text-xs">
        {/* Strategy Card */}
        <div className="p-3.5 rounded-xl bg-accent-500/10 border border-accent-500/30 space-y-2">
          <div className="flex items-center gap-2 text-accent-300 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-accent-400" />
            Estratégia de Visita & Melhores Horários
          </div>
          <p className="text-ink-200 leading-relaxed">
            {insights.strategy}
          </p>
        </div>

        {/* Kids & Height Alert */}
        <div className="p-3.5 rounded-xl bg-info-500/10 border border-info-500/30 space-y-2">
          <div className="flex items-center gap-2 text-info-300 font-bold text-sm">
            <Baby className="w-4 h-4 text-info-400" />
            Gabriela (4 anos) & Alturas Mínimas
          </div>
          <p className="text-ink-200 leading-relaxed">
            {insights.heightAlert}
          </p>
        </div>

        {/* Low Cost Dining in Venue */}
        <div className="p-3.5 rounded-xl bg-warning-500/10 border border-warning-500/30 space-y-2">
          <div className="flex items-center gap-2 text-warning-300 font-bold text-sm">
            <Utensils className="w-4 h-4 text-warning-400" />
            Alimentação Econômica & Hidratação
          </div>
          <p className="text-ink-200 leading-relaxed">
            {insights.diningTip}
          </p>
        </div>

        {/* Rest Spots & Air Conditioning */}
        <div className="p-3.5 rounded-xl bg-ink-900 border border-ink-800 space-y-2">
          <div className="flex items-center gap-2 text-success-400 font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-success-400" />
            Pausa para Descanso & Ar-Condicionado
          </div>
          <p className="text-ink-300 leading-relaxed">
            {insights.restSpot}
          </p>
        </div>

        {/* Action Footer */}
        <div className="pt-3 border-t border-ink-800 flex items-center justify-between">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-info-600 hover:bg-info-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            Abrir Rota no Google Maps <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-ink-300 font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
