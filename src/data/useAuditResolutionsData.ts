import { useCallback, useEffect, useState } from 'react';
import type { SupabaseLike } from './useTripsData';

export interface AuditResolutionsDataDeps {
  client: SupabaseLike;
  tripId: string | null;
  fallbackResolvedIds?: string[];
}

export function useAuditResolutionsData({ client, tripId, fallbackResolvedIds = [] }: AuditResolutionsDataDeps) {
  const [resolvedAuditIds, setResolvedAuditIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    if (!tripId) {
      setResolvedAuditIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    client
      .from('audit_finding_resolutions')
      .select('finding_id')
      .eq('trip_id', tripId)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (!error && data && data.length > 0) {
          setResolvedAuditIds((data as Array<{ finding_id: string }>).map(r => r.finding_id));
        } else if (fallbackResolvedIds.length > 0) {
          setResolvedAuditIds(fallbackResolvedIds);
        } else {
          setResolvedAuditIds([]);
        }
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [client, tripId]);

  const toggleResolveAudit = useCallback(
    (id: string) => {
      if (!tripId) return;

      const isResolved = resolvedAuditIds.includes(id);

      if (isResolved) {
        setResolvedAuditIds(prev => prev.filter(x => x !== id));
        client
          .from('audit_finding_resolutions')
          .delete()
          .eq('trip_id', tripId);
      } else {
        setResolvedAuditIds(prev => [...prev, id]);
        client
          .from('audit_finding_resolutions')
          .insert({ trip_id: tripId, finding_id: id });
      }
    },
    [client, tripId, resolvedAuditIds],
  );

  return {
    resolvedAuditIds,
    loading,
    toggleResolveAudit,
  };
}
