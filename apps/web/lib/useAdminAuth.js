'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from './adminApi';
import { ApiError } from './api';

export function useAdminAuth() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    adminApi
      .get('/api/admin/auth/me')
      .then(({ admin: a }) => {
        if (!cancelled) setAdmin(a);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/admin/login');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { admin, setAdmin, loading };
}
