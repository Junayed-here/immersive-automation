'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from './api';

export function useAuth() {
  const router = useRouter();
  const [realtor, setRealtor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/api/auth/me')
      .then(({ realtor: r }) => {
        if (!cancelled) setRealtor(r);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { realtor, setRealtor, loading };
}
