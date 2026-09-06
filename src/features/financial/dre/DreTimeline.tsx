import React from 'react';
import type { DreGlobalResult } from '../../../services/dreEngine';
import { Plane, Utensils } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DreTimelineProps {
  dreResult: DreGlobalResult;
  formatVal: (valUsd: number, valBrl: number) => string;
  chartCategoryData: { name: string; Planejado: number; Realizado: number; A_Provisionar: number }[];
  pieData: { name: string; value: number; color: string }[];
  currency: 'USD' | 'BRL';
}

export const DreTimeline: React.FC<DreTimelineProps> = ({
  dreResult,
  formatVal,
  chartCategoryData,
  pieData,
  currency
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloco 1: Pré-Viagem */}
        <div className="glass-panel p-6 rounded-2xl border border-info-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-info-500/10 text-info-400 flex items-center justify-center">
                <Plane className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink-100">Desembolsos Pré-Viagem (Custos Fixos)</h3>
                <p className="text-[11px] text-ink-400">Passagens, hotéis parcelados, ingressos e documentação</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-ink-950/80 border border-ink-800 text-xs">
            <div>
              <span className="text-ink-400 block text-[11px]">Orçado Pré-Viagem:</span>
              <span className="font-bold text-ink-200 text-base">
                {formatVal(dreResult.pre_trip_planned_usd, dreResult.pre_trip_planned_brl)}
              </span>
            </div>
            <div>
              <span className="text-success-400 block text-[11px]">Já Pago no Brasil:</span>
              <span className="font-bold text-success-400 text-base">
                {formatVal(dreResult.pre_trip_actual_usd, dreResult.pre_trip_actual_brl)}
              </span>
            </div>
          </div>

          <p className="text-xs text-ink-400">
            Essas despesas devem estar 100% quitadas antes do embarque para evitar comprometer o limite de crédito durante a viagem.
          </p>
        </div>

        {/* Bloco 2: Na Viagem */}
        <div className="glass-panel p-6 rounded-2xl border border-success-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-success-500/10 text-success-400 flex items-center justify-center">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink-100">Desembolsos Durante a Viagem (Variáveis)</h3>
                <p className="text-[11px] text-ink-400">Alimentação, compras, combustível, Uber e imprevistos</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-ink-950/80 border border-ink-800 text-xs">
            <div>
              <span className="text-ink-400 block text-[11px]">Meta de Consumo In Loco:</span>
              <span className="font-bold text-ink-200 text-base">
                {formatVal(dreResult.in_trip_planned_usd, dreResult.in_trip_planned_brl)}
              </span>
            </div>
            <div>
              <span className="text-warning-400 block text-[11px]">A Levar em Moeda/Cartão:</span>
              <span className="font-bold text-warning-300 text-base">
                {formatVal(dreResult.in_trip_planned_usd - dreResult.in_trip_actual_usd, dreResult.in_trip_planned_brl - dreResult.in_trip_actual_brl)}
              </span>
            </div>
          </div>

          <p className="text-xs text-ink-400">
            Valor que precisa estar disponível na conta internacional (Nomad / Wise / Espécie) para os dias de viagem.
          </p>
        </div>
      </div>

      {/* Gráficos de Comparativo e Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-ink-800">
          <h4 className="text-sm font-bold text-ink-100 mb-4">
            Comparativo: Planejado vs. Realizado vs. A Provisionar
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCategoryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Planejado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="A_Provisionar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-ink-800">
          <h4 className="text-sm font-bold text-ink-100 mb-4">
            Composição Percentual dos Gastos Realizados
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(val: any) => [
                    `${currency === 'BRL' ? 'R$' : 'US$'} ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    'Realizado'
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
