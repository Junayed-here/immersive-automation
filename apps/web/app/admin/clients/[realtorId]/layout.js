'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';

function tabsFor(realtorId) {
  return [
    { href: `/admin/clients/${realtorId}`, label: 'Overview', exact: true },
    { href: `/admin/clients/${realtorId}/buyers`, label: 'Buyers' },
    { href: `/admin/clients/${realtorId}/automations`, label: 'Automations' },
    { href: `/admin/clients/${realtorId}/settings`, label: 'Settings' },
  ];
}

export default function ClientLayout({ children, params }) {
  const { realtorId } = params;
  const pathname = usePathname();
  const [realtor, setRealtor] = useState(null);

  useEffect(() => {
    adminApi
      .get(`/api/admin/clients/${realtorId}`)
      .then((data) => setRealtor(data.realtor))
      .catch(() => {});
  }, [realtorId]);

  const tabs = tabsFor(realtorId);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Link href="/admin/clients" className="text-xs text-slate hover:underline">
          ← All clients
        </Link>
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">{realtor ? realtor.fullName : 'Client'}</h1>
      {realtor ? <p className="mt-0.5 text-sm text-slate">{realtor.email}</p> : null}

      <div className="mb-6 mt-4 flex items-center gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
                active ? 'border-verdigris text-ink' : 'border-transparent text-slate hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
