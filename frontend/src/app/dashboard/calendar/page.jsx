'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

const STATUS_COLORS = {
  draft: 'bg-neutral-800 text-neutral-400',
  pending_review: 'bg-yellow-500/15 text-yellow-400',
  approved: 'bg-blue-500/15 text-blue-400',
  scheduled: 'bg-purple-500/15 text-purple-400',
  published: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
};

export default function CalendarPage() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateDrafts, setDateDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

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
      const businesses = bizRes.data || [];

      const results = await Promise.all(
        businesses.map((b) =>
          apiRequest(`/businesses/${b.id}/content/posts`)
            .then((r) => (r.data || []).map((p) => ({ ...p, businessName: b.name })))
            .catch(() => [])
        )
      );

      const all = results.flat().sort((a, b) => {
        const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
        const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
        if (da !== db) return da - db;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setPosts(all);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule(post) {
    const value = dateDrafts[post.id];
    if (!value) return;
    setSavingId(post.id);
    try {
      const iso = new Date(value).toISOString();
      const res = await apiRequest(`/content/posts/${post.id}`, {
        method: 'PATCH',
        body: { scheduled_at: iso, status: 'scheduled' },
      });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...res.data } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

  const scheduled = posts.filter((p) => p.scheduled_at);
  const unscheduled = posts.filter((p) => !p.scheduled_at);

  return (
    <main className="min-h-screen px-8 py-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Content Calendar</h1>
      <p className="text-neutral-500 text-sm mb-8">All generated posts across your businesses, in one place.</p>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {posts.length === 0 && (
        <div className="border border-dashed border-neutral-800 rounded-xl p-10 text-center text-neutral-400">
          No posts yet. Generate content from a business page first.
        </div>
      )}

      {scheduled.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">Scheduled</h2>
          <div className="space-y-3">
            {scheduled.map((post) => (
              <PostRow key={post.id} post={post} dateDrafts={dateDrafts} setDateDrafts={setDateDrafts} saveSchedule={saveSchedule} savingId={savingId} />
            ))}
          </div>
        </section>
      )}

      {unscheduled.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">Not yet scheduled</h2>
          <div className="space-y-3">
            {unscheduled.map((post) => (
              <PostRow key={post.id} post={post} dateDrafts={dateDrafts} setDateDrafts={setDateDrafts} saveSchedule={saveSchedule} savingId={savingId} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function PostRow({ post, dateDrafts, setDateDrafts, saveSchedule, savingId }) {
  return (
    <div className="border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono uppercase px-2.5 py-1 rounded ${post.platform === 'instagram' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'}`}>
            {post.platform}
          </span>
          <span className={`text-xs font-mono uppercase px-2.5 py-1 rounded ${STATUS_COLORS[post.status] || 'bg-neutral-800 text-neutral-400'}`}>
            {post.status}
          </span>
          <span className="text-xs text-neutral-500">{post.businessName}</span>
        </div>
        {post.scheduled_at && (
          <span className="text-xs text-neutral-400">
            {new Date(post.scheduled_at).toLocaleString()}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3 text-neutral-200">{post.caption}</p>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="datetime-local"
          className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
          value={dateDrafts[post.id] || ''}
          onChange={(e) => setDateDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
        />
        <button
          onClick={() => saveSchedule(post)}
          disabled={savingId === post.id || !dateDrafts[post.id]}
          className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium disabled:opacity-50"
        >
          {savingId === post.id ? 'Saving…' : 'Schedule'}
        </button>
      </div>
    </div>
  );
}
