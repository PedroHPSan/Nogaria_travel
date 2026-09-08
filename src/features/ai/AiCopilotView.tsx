import React, { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { ViewHeader } from '../../components/ui/ViewHeader';
import { sendCopilotMessage } from '../../services/ai/copilotClient';
import {
  Sparkles,
  Send,
  Sliders,
  Cpu,
  History,
  AlertTriangle
} from 'lucide-react';


export const AiCopilotView: React.FC = () => {
  const {
    activeTrip,
    participants,
    aiProviders,
    updateAiProvider,
    aiLogs
  } = useTrip();


  const [activeProviderId, setActiveProviderId] = useState<string>(
    aiProviders.find(p => p.is_default)?.id || aiProviders[0]?.id || 'ai-gemini'
  );

  const minors = participants.filter(p => p.is_minor);
  const minorsLabel = minors.length > 0
    ? minors.map(p => `${p.nickname || p.full_name} (${p.age} anos)`).join(' e ')
    : 'os participantes menores de idade';

  const [promptInput, setPromptInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: string }[]>([
    {
      role: 'assistant',
      content: `Olá! Sou o Copiloto de Inteligência Artificial da Plataforma de Viagens. Analisei a viagem "${activeTrip.title}" e estou pronto para responder perguntas sobre voos, hospedagens, gift cards, orçamento, bagagens ou restrições de idade para ${minorsLabel}.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeProvider = aiProviders.find(p => p.id === activeProviderId) || aiProviders[0];

  const handlePresetPrompt = (text: string) => {
    setPromptInput(text);
    handleSend(text);
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || promptInput;
    if (!query.trim() || isProcessing) return;

    const userTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const historyForCall = messages.map(m => ({ role: m.role, text: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: query, timestamp: userTime }]);
    if (!textToSend) setPromptInput('');
    setIsProcessing(true);

    // ai_usage_logs já é gravado pela Edge Function — addAiLog() não é chamado
    // aqui de novo pra não duplicar o registro de custo.
    const result = await sendCopilotMessage({ trip_id: activeTrip.id, message: query, history: historyForCall });

    const botTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'assistant', content: result.text ?? result.error ?? 'Não consegui responder agora.', timestamp: botTime }]);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <ViewHeader
        title="Copiloto IA & Configuração do Gemini"
        subtitle="Chat com acesso real ao roteiro, tarefas e voos da viagem via Gemini. Suporte a outros provedores (OpenAI, Claude, DeepSeek) ainda não foi implementado."
        actions={
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-ink-900 border border-ink-800 text-xs">
            <Cpu className="w-4 h-4 text-accent-400" />
            <span className="font-semibold text-ink-300">Provedor Ativo:</span>
            <select
              value={activeProviderId}
              onChange={e => setActiveProviderId(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-ink-950 border border-ink-700 text-ink-100 font-bold text-xs"
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
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-ink-800 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-ink-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-accent-600 flex items-center justify-center text-white font-bold shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink-100">Assistente de Viagem IA</h3>
                <p className="text-[10px] text-success-400 font-semibold">Provedor: gemini • {activeProvider?.model_name}</p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-info-500/10 text-info-400 border border-info-500/20">
              Contexto Completo Ativo
            </span>
          </div>

          {activeProvider && activeProvider.provider !== 'gemini' && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              O provedor "{activeProvider.provider}" ainda não foi implementado — as respostas usam Gemini de qualquer forma.
            </div>
          )}

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar text-[11px]">
            <button
              onClick={() => handlePresetPrompt('O que temos no roteiro de hoje?')}
              className="px-2.5 py-1 rounded-lg bg-ink-900 hover:bg-ink-800 border border-ink-800 text-ink-300 transition whitespace-nowrap"
            >
              📅 Roteiro de hoje
            </button>
            <button
              onClick={() => handlePresetPrompt('Quais tarefas estão pendentes?')}
              className="px-2.5 py-1 rounded-lg bg-ink-900 hover:bg-ink-800 border border-ink-800 text-ink-300 transition whitespace-nowrap"
            >
              📋 Tarefas pendentes
            </button>
            <button
              onClick={() => handlePresetPrompt('Quando é o próximo voo?')}
              className="px-2.5 py-1 rounded-lg bg-ink-900 hover:bg-ink-800 border border-ink-800 text-ink-300 transition whitespace-nowrap"
            >
              ✈️ Próximo voo
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
                      ? 'bg-info-600 text-white rounded-tr-none'
                      : 'bg-ink-900 border border-ink-800 text-ink-200 rounded-tl-none'
                  }`}
                >
                  {m.content}
                  <div className="text-[9px] opacity-60 text-right mt-1">{m.timestamp}</div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="text-xs text-ink-400 animate-pulse flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent-400" />
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
            className="pt-3 border-t border-ink-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              placeholder="Faça uma pergunta sobre o planejamento da viagem..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-ink-950 border border-ink-800 text-xs text-ink-100 focus:outline-none focus:border-info-500"
            />
            <button
              type="submit"
              disabled={isProcessing || !promptInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-accent-600 hover:from-indigo-500 hover:to-accent-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Sidebar: AI Provider Controls & Token Consumption Logs */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-ink-800 space-y-4">
            <h3 className="font-bold text-sm text-ink-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent-400" />
              Configurações do Provedor
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-300 font-semibold mb-1">Modelo de IA</label>
                <input
                  type="text"
                  value={activeProvider?.model_name || ''}
                  onChange={e => activeProvider && updateAiProvider(activeProvider.id, { model_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100"
                />
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Temperatura (Criatividade)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={activeProvider?.temperature || 0.2}
                  onChange={e => activeProvider && updateAiProvider(activeProvider.id, { temperature: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-ink-400">
                  <span>Determinístico (0.0)</span>
                  <span>{activeProvider?.temperature}</span>
                  <span>Criativo (1.0)</span>
                </div>
              </div>

              <div>
                <label className="block text-ink-300 font-semibold mb-1">Limite Diário de Tokens</label>
                <input
                  type="number"
                  value={activeProvider?.daily_token_limit || 100000}
                  onChange={e => updateAiProvider(activeProvider.id, { daily_token_limit: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-ink-800 text-ink-100 font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-ink-800 space-y-3">
            <h3 className="font-bold text-sm text-ink-100 flex items-center gap-2">
              <History className="w-4 h-4 text-info-400" />
              Histórico de Consumo de IA ({aiLogs.length})
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto text-[11px]">
              {aiLogs.map(log => (
                <div key={log.id} className="p-2.5 rounded-lg bg-ink-900/60 border border-ink-800 space-y-1">
                  <div className="flex items-center justify-between text-ink-300 font-semibold">
                    <span>{log.function_name}</span>
                    <span className="text-success-400 font-mono">US$ {log.estimated_cost_usd}</span>
                  </div>
                  <div className="text-[10px] text-ink-400">
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
