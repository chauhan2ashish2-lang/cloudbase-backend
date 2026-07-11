'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newBiz, setNewBiz] = useState({ name: '', industry: '', productsServices: '', targetAudience: '', country: '', language: 'en' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    try {
      const data = await apiRequest('/businesses');
      setBusinesses(data.data);
    } catch (err) {
      if (err.message?.includes('token')) router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/businesses', { method: 'POST', body: newBiz });
      setShowForm(false);
      setNewBiz({ name: '', industry: '', productsServices: '', targetAudience: '', country: '', language: 'en' });
      loadBusinesses();
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-2xl font-bold">Your Businesses</h1>
        <button onClick={logout} className="text-sm text-neutral-500 hover:text-neutral-300">Log out</button>
      </div>

      {loading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : (
        <>
          {businesses.length === 0 && !showForm && (
            <div className="border border-dashed border-neutral-800 rounded-xl p-10 text-center">
              <p className="text-neutral-400 mb-4">No businesses yet. Add your first one to get started.</p>
              <button onClick={() => setShowForm(true)} className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium">
                + Add a business
              </button>
            </div>
          )}

          {businesses.length > 0 && (
            <div className="grid gap-4 mb-6">
              {businesses.map((b) => (
                <div key={b.id} onClick={() => router.push(`/dashboard/business/${b.id}`)} className="border border-neutral-800 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:border-neutral-700 transition-colors">
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="text-sm text-neutral-500">{b.industry || 'No industry set'} · {b.onboarding_status}</div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {b.onboarding_status}
                  </span>
                </div>
              ))}
              {!showForm && (
                <button onClick={() => setShowForm(true)} className="text-sm text-orange-400 text-left">
                  + Add another business
                </button>
              )}
            </div>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="border border-neutral-800 rounded-xl p-6 space-y-3">
              <h2 className="font-medium mb-2">Add a business</h2>
              {error && <div className="text-sm text-red-400">{error}</div>}
              <input className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 outline-none"
                placeholder="Business name" value={newBiz.name}
                onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })} required />
              <input className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 outline-none"
                placeholder="Industry (e.g. Coffee shop, Real estate)" value={newBiz.industry}
                onChange={(e) => setNewBiz({ ...newBiz, industry: e.target.value })} />
              <input className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 outline-none"
                placeholder="Products / services" value={newBiz.productsServices}
                onChange={(e) => setNewBiz({ ...newBiz, productsServices: e.target.value })} />
              <input className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 outline-none"
                placeholder="Target audience" value={newBiz.targetAudience}
                onChange={(e) => setNewBiz({ ...newBiz, targetAudience: e.target.value })} />
              <input className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 outline-none"
                placeholder="Country" value={newBiz.country}
                onChange={(e) => setNewBiz({ ...newBiz, country: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg border border-neutral-800">Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </main>
  );
}
