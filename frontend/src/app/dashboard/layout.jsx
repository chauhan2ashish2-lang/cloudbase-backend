'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Businesses', icon: '🏢', enabled: true },
  { href: '/dashboard/calendar', label: 'Content Calendar', icon: '🗓️', enabled: true },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊', enabled: true },
  { href: '/dashboard/ads', label: 'Ads Manager', icon: '📣', enabled: false },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️', enabled: false },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex bg-black text-white">
      <aside className="w-60 shrink-0 border-r border-neutral-800 flex flex-col p-5">
        <div className="mb-8">
          <div className="text-lg font-bold tracking-tight">AI Marketing</div>
          <div className="text-xs text-neutral-500">Manager</div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            if (!item.enabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-neutral-600 cursor-not-allowed"
                  title="Coming soon"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span>{item.icon}</span>{item.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">Soon</span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>{item.label}
              </Link>
            );
          })}
        </nav>

        <button onClick={logout} className="mt-4 text-sm text-neutral-500 hover:text-neutral-300 text-left px-3 py-2">
          Log out
        </button>
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
