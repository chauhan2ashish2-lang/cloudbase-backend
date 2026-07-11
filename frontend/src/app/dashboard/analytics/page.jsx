'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

function Bar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-neutral-300 capitalize">{label.replace(/_/g, ' ')}</span>
        <span className="text-neutral-500">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-900 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const bizRes = await apiRequest('/businesses');
      const bizList = bizRes.data || [];
      setBusinesses(bizList);

      const results = await Promise.all(
        bizList.map((b) =>
          apiRequest(`/businesses/${b.id}/content/posts`)
            .then((r) => (r.data || []).map((p) => ({ ...p, businessName: b.name })))
            .catch(() => [])
        )
      );
      setPosts(results.flat());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

  const total = posts.length;
  const activeBusinesses = businesses.filter((b) => b.onboarding_status === 'active').length;

  const byStatus = {};
  const byPlatform = {};
  const byCategory = {};
  posts.forEach((p) => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1;
    if (p.category) byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  });

  const perBusiness = businesses.map((b) => ({
    name: b.name,
    count: posts.filter((p) => p.businessName === b.name).length,
  }));

  return (
    <main className="min-h-screen px-8 py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Analytics</h1>
      <p className="text-neutral-500 text-sm mb-8">Content activity across your account.</p>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="border border-neutral-800 rounded-xl p-5">
          <div className="text-3xl font-bold">{businesses.length}</div>
          <div className="text-sm text-neutral-500 mt-1">Businesses</div>
        </div>
        <div className="border border-neutral-800 rounded-xl p-5">
          <div className="text-3xl font-bold">{activeBusinesses}</div>
          <div className="text-sm text-neutral-500 mt-1">Active</div>
        </div>
        <div className="border border-neutral-800 rounded-xl p-5">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-sm text-neutral-500 mt-1">Posts generated</div>
        </div>
      </div>

      {total === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-xl p-10 text-center text-neutral-400">
          No posts yet. Generate content from a business page to see stats here.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">By status</h2>
            {Object.entries(byStatus).map(([k, v]) => (
              <Bar key={k} label={k} count={v} total={total} color="bg-orange-500" />
            ))}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">By platform</h2>
            {Object.entries(byPlatform).map(([k, v]) => (
              <Bar key={k} label={k} count={v} total={total} color="bg-blue-500" />
            ))}
            {Object.keys(byCategory).length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4 mt-6">By category</h2>
                {Object.entries(byCategory).map(([k, v]) => (
                  <Bar key={k} label={k} count={v} total={total} color="bg-green-500" />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {perBusiness.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Posts per business</h2>
          <div className="space-y-2">
            {perBusiness.map((b) => (
              <div key={b.name} className="flex justify-between border border-neutral-800 rounded-lg px-4 py-3 text-sm">
                <span>{b.name}</span>
                <span className="text-neutral-500">{b.count} posts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-dashed border-neutral-800 rounded-xl p-6 text-sm text-neutral-500">
        📊 Reach, engagement, and ad performance will appear here once you connect your Facebook/Instagram account. That connection isn't set up yet.
      </div>
    </main>
  );
}
