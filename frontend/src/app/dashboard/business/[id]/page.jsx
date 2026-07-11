'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

export default function BusinessDetailPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.id;

  const [business, setBusiness] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    loadData();
  }, [businessId]);

  async function loadData() {
    try {
      const [bizRes, postsRes] = await Promise.all([
        apiRequest(`/businesses/${businessId}`),
        apiRequest(`/businesses/${businessId}/content/posts`),
      ]);
      setBusiness(bizRes.data);
      setPosts(postsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const result = await apiRequest(`/businesses/${businessId}/content/generate`, {
        method: 'POST',
        body: { count: 4 },
      });
      setPosts([...(result.data || []), ...posts]);
      setBusiness({ ...business, onboarding_status: 'active' });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-300 mb-6 inline-block">
        ← All businesses
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{business?.name}</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {[business?.industry, business?.target_audience, business?.country].filter(Boolean).join(' · ') || 'No details set'}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium disabled:opacity-50 whitespace-nowrap"
        >
          {generating ? 'Generating…' : '✦ Generate content'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-xl p-10 text-center">
          <p className="text-neutral-400 mb-4">No posts generated yet for this business.</p>
          <button onClick={handleGenerate} disabled={generating} className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium disabled:opacity-50">
            {generating ? 'Generating…' : '✦ Generate this week\'s posts'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <div key={post.id} className="border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono uppercase px-2.5 py-1 rounded ${post.platform === 'instagram' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'}`}>
                  {post.platform}
                </span>
                <span className="text-xs text-neutral-500 font-mono uppercase">{post.category}</span>
              </div>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap mb-3">{post.caption}</p>
              <p className="text-sm text-blue-400 mb-3">
                {(post.hashtags || []).map((h) => `#${h}`).join('  ')}
              </p>
              <div className="text-sm text-green-400 font-mono pt-3 border-t border-neutral-800">
                → {post.cta}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
