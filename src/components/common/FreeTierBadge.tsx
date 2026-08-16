import React, { useEffect, useState } from 'react';
import { getLocalQuotaStatus, type QuotaStatus } from '../../services/api/placesService';
import { ShieldCheck } from 'lucide-react';

export const FreeTierBadge: React.FC = () => {
  const [quota, setQuota] = useState<QuotaStatus>(getLocalQuotaStatus);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuota(getLocalQuotaStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      title="Controle estrito de consumo Free Tier (Custo R$ 0,00 garantido com cache de 3 dias)"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-medium text-emerald-300"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
      <span>Free Tier Ativo</span>
      <span className="text-emerald-400/60 font-mono text-[10px]">
        (Google {quota.googleUsedToday}/{quota.googleMaxDaily} hoje • Cache 3d)
      </span>
    </div>
  );
};
