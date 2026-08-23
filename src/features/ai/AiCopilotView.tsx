import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ViewHeader } from '../../components/ui/ViewHeader';
import {
  Sparkles,
  Send,
  Sliders,
  Cpu,
  History
} from 'lucide-react';


export const AiCopilotView: React.FC = () => {
  const {
    activeTrip,
    participants,
    flights,
    accommodations,
    transports,
    giftCards,
    tasks,
    aiProviders,
    updateAiProvider,
    aiLogs,
    addAiLog
  } = useTrip();


  const [activeProviderId, setActiveProviderId] = useState<string>(
    aiProviders.find(p => p.is_default)?.id || aiProviders[0]?.id || 'ai-gemini'
  );

  const [promptInput, setPromptInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: string }[]>([
    {
      role: 'assistant',
      content: `Olá! Sou o Copiloto de Inteligência Artificial da Plataforma de Viagens. Analisei a viagem "${activeTrip.title}" e estou pronto para responder perguntas sobre voos, hospedagens, gift cards, orçamento, bagagens ou restrições de idade para a pequena Gabi (4 anos) e Débora (12 anos).`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeProvider = aiProviders.find(p => p.id === activeProviderId) || aiProviders[0];

  const handlePresetPrompt = (text: string) => {
    setPromptInput(text);
    handleSend(text);
  };

  const handleSend = (textToSend?: string) => {
    const query = textToSend || promptInput;
    if (!query.trim() || isProcessing) return;

    const userTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', content: query, timestamp: userTime }]);
    if (!textToSend) setPromptInput('');
    setIsProcessing(true);

    setTimeout(() => {
      let responseText = '';
      const q = query.toLowerCase();

      if (q.includes('hotel') || q.includes('hospedagem')) {
        const confirmAccs = accommodations.filter(a => a.status === 'confirmed');
        responseText = `Existem ${confirmAccs.length} hospedagens confirmadas ativas:\n1. ${confirmAccs.map(a => `${a.name} (${a.city})`).join('\n2. ')}.\nNota: A reserva do Celebration Suites foi substituída pelo Four Points FLL para garantir proximidade do aeroporto FLL no voo noturno de devolução.`;
      } else if (q.includes('gift card') || q.includes('economia') || q.includes('custo real')) {
        const nominal = giftCards.reduce((s, g) => s + g.nominal_value, 0);
        const net = giftCards.reduce((s, g) => s + g.net_cost, 0);
        const savings = nominal - net;
        responseText = `A carteira possui US$ ${nominal} em valor nominal. O custo real líquido é de US$ ${net.toFixed(2)}, gerando uma economia efetiva total de US$ ${savings.toFixed(2)} (${((savings/nominal)*100).toFixed(1)}% de desconto real).`;
      } else if (q.includes('pedro') || q.includes('orçamento')) {
        const pedro = participants.find(p => p.nickname === 'Pedro');
        responseText = `Pedro possui teto de orçamento de US$ ${pedro?.budget_limit_usd || 2000}. O foco de compras é iPhone Pro Max 512GB (US$ 1.399) e Apple Watch Ultra, abatendo saldo com Gift Cards Apple.`;
      } else if (q.includes('gabi') || q.includes('altura') || q.includes('criança')) {
        const gabi = participants.find(p => p.nickname === 'Gabi');
        responseText = `Gabi tem 4 anos e ${gabi?.height_cm || 100}cm de altura. Ela não atinge a altura mínima de 130cm para montanhas-russas radicais como VelociCoaster na Universal. O grupo deve utilizar a funcionalidade Child Swap / Rider Switch.`;
      } else if (q.includes('carro') || q.includes('devolução') || q.includes('19')) {
        const car = transports.find(t => t.type === 'rental_car');
        responseText = `A devolução do veículo (${car?.provider_company || 'Hertz / Alamo'}) em Fort Lauderdale está marcada para dia 19/09 às 17h30. Há uma pendência para agendar Uber XL corporativo para levar o grupo de 4 passageiros e malas ao hotel Four Points / Aeroporto FLL.`;
      } else {
        responseText = `Com base nos dados atualizados da viagem:\n- Participantes: ${participants.map(p => p.full_name).join(', ')}\n- Voos cadastrados: ${flights.length}\n- Gift Cards com saldo: ${giftCards.filter(g => g.status === 'active').length}\n- Apontamentos de auditoria: ${tasks.filter(t => t.status === 'pending').length} pendências.`;
      }

      const botTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { role: 'assistant', content: responseText, timestamp: botTime }]);
      setIsProcessing(false);

      // Log AI Usage
      addAiLog({
        user_name: 'Usuário SaaS',
        function_name: 'Chat Copiloto Contextual',
        provider: activeProvider.provider,
        model: activeProvider.model_name,
        tokens_input: query.length * 2 + 300,
        tokens_output: responseText.length * 2,
        estimated_cost_usd: 0.0008
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title="Copiloto IA Transversal & Gestão de Provedores"
        subtitle="Interface de IA contextualizada com acesso aos módulos da viagem e gerenciamento seguro de tokens e modelos (Gemini, OpenAI, Claude, DeepSeek)."
        actions={
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-slate-300">Provedor Ativo:</span>
            <select
              value={activeProviderId}
              onChange={e => setActiveProviderId(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-xs"
            >
              {aiProviders.map(p => (
                <option key={p.id} value={p.id}>
                  {p.provider.toUpperCase()} ({p.model_name})
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Main Window */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Assistente de Viagem IA</h3>
                <p className="text-[10px] text-emerald-400 font-semibold">Provedor: {activeProvider?.provider} • {activeProvider?.model_name}</p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Contexto Completo Ativo
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar text-[11px]">
            <button
              onClick={() => handlePresetPrompt('Existe algum dia sem hotel?')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition whitespace-nowrap"
            >
              ❓ Há dias sem hotel?
            </button>
            <button
              onClick={() => handlePresetPrompt('Qual é o custo real dos gift cards?')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition whitespace-nowrap"
            >
              💳 Custo real gift cards
            </button>
            <button
              onClick={() => handlePresetPrompt('Que atividades não são adequadas para Gabi?')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition whitespace-nowrap"
            >
              👧 Atrações Gabi (4a)
            </button>
            <button
              onClick={() => handlePresetPrompt('Existe conflito entre a devolução do carro e o voo?')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition whitespace-nowrap"
            >
              🚗 Devolução carro 19/09
            </button>
          </div>

          {/* Message History */}
          <div className="flex-1 overflow-y-auto space-y-3 p-2 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    IA
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-3 rounded-2xl whitespace-pre-line leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {m.content}
                  <div className="text-[9px] opacity-60 text-right mt-1">{m.timestamp}</div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="text-xs text-slate-400 animate-pulse flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Processando consulta no modelo {activeProvider?.model_name}...
              </div>
            )}
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="pt-3 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              placeholder="Faça uma pergunta sobre o planejamento da viagem..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isProcessing || !promptInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Sidebar: AI Provider Controls & Token Consumption Logs */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Configurações do Provedor
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Modelo de IA</label>
                <input
                  type="text"
                  value={activeProvider?.model_name || ''}
                  onChange={e => updateAiProvider(activeProvider.id, { model_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Temperatura (Criatividade)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={activeProvider?.temperature || 0.2}
                  onChange={e => updateAiProvider(activeProvider.id, { temperature: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Determinístico (0.0)</span>
                  <span>{activeProvider?.temperature}</span>
                  <span>Criativo (1.0)</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Limite Diário de Tokens</label>
                <input
                  type="number"
                  value={activeProvider?.daily_token_limit || 100000}
                  onChange={e => updateAiProvider(activeProvider.id, { daily_token_limit: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Histórico de Consumo de IA ({aiLogs.length})
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto text-[11px]">
              {aiLogs.map(log => (
                <div key={log.id} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span>{log.function_name}</span>
                    <span className="text-emerald-400 font-mono">US$ {log.estimated_cost_usd}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {log.provider} ({log.model}) • {log.tokens_input + log.tokens_output} tokens
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
