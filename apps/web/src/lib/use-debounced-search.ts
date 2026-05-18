'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type ApiOptions } from '@/lib/api-client';

export interface SearchHit {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  priceCents: number;
  allergens: string[];
  available: boolean;
}

interface SearchResponse {
  hits: SearchHit[];
  totalHits: number;
  processingTimeMs?: number;
}

export function useDebouncedSearch(args: {
  path: string;
  q: string;
  delayMs?: number;
  options?: ApiOptions;
}) {
  const { path, q, delayMs = 200, options } = args;
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const myReq = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.get<SearchResponse>(
          `${path}?q=${encodeURIComponent(term)}`,
          options,
        );
        if (myReq !== reqId.current) return; // newer query landed
        setHits(res.hits);
        setError(null);
      } catch (err) {
        if (myReq !== reqId.current) return;
        setError((err as Error).message);
        setHits([]);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, q, delayMs, options?.tenantSlug]);

  return { hits, loading, error, active: q.trim().length > 0 };
}
