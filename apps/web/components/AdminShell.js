'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { AccountSettingsModal } from '@/components/AccountSettingsModal';

function SidebarContent({ pathname, admin, loading, onLogout, onNavigate, onOpenAccount }) {
  return (
    <>
      <div>
        <div className="border-b border-white/10 px-5 py-5">
          <div className="font-display text-xl font-semibold tracking-tight">Ledger</div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/50">Admin</div>
        </div>
        <nav className="mt-4 flex flex-col gap-0.5 px-3">
          <Link
            href="/admin/clients"
            onClick={onNavigate}
            className={`rounded px-3 py-2 text-sm transition-colors ${
              pathname?.startsWith('/admin/clients') ? 'bg-verdigris text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            Clients
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10 p-4">
        {!loading && admin ? (
          <button onClick={onOpenAccount} className="mb-3 block w-full text-left hover:opacity-80">
            <div className="text-sm font-medium">{admin.name}</div>
            <div className="truncate text-xs text-white/50">{admin.email}</div>
          </button>
        ) : null}
        <button
          onClick={onLogout}
          className="w-full rounded border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
        >
          Log out
        </button>
      </div>
    </>
  );
}

export function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, loading } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  async function handleLogout() {
    await adminApi.post('/api/admin/auth/logout').catch(() => {});
    router.replace('/admin/login');
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar - unchanged, always visible at md: and above. */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-ink text-white md:flex">
        <SidebarContent
          pathname={pathname}
          admin={admin}
          loading={loading}
          onLogout={handleLogout}
          onOpenAccount={() => setAccountOpen(true)}
        />
      </aside>

      {/* Mobile top bar, shown instead of the sidebar below md:. */}
      <div className="flex items-center justify-between border-b border-line bg-ink px-4 py-3 text-white md:hidden">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="font-display text-lg font-semibold tracking-tight">Ledger</div>
        <div className="w-8" />
      </div>

      {/* Mobile slide-in drawer, toggled by the top bar above. */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex w-60 shrink-0 flex-col justify-between bg-ink text-white">
            <SidebarContent
              pathname={pathname}
              admin={admin}
              loading={loading}
              onLogout={handleLogout}
              onNavigate={() => setMenuOpen(false)}
              onOpenAccount={() => {
                setMenuOpen(false);
                setAccountOpen(true);
              }}
            />
          </div>
          <button aria-label="Close menu" className="flex-1 bg-ink/40" onClick={() => setMenuOpen(false)} />
        </div>
      ) : null}

      <main className="flex-1 overflow-y-auto bg-paper px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      <AccountSettingsModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
