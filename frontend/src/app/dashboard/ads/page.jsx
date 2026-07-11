'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

const OBJECTIVES = ['leads', 'sales', 'traffic', 'awareness', 'app_installs'];
const STATUS_COLORS = {
  draft: 'bg-neutral-800 text-neutral-400',
  pending_approval: 'bg-yellow-500/15 text-yellow-400',
  active: 'bg-green-500/15 text-green-400',
  paused: 'bg-orange-500/15 text-orange-400',
  completed: 'bg-blue-500/15 text-blue-400',
  archived: 'bg-neutral-800 text-neutral-500',
};

export default function AdsPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ business_id: '', name: '', objective: 'leads', daily_budget: '', start_date: '', end_date: '' });

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
      if (bizList.length && !form.business_id) {
        setForm((f) => ({ ...f, business_id: bizList[0].id }));
      }

      const results = await Promise.all(
        bizList.map((b) =>
          apiRequest(`/businesses/${b.id}/ads/campaigns`)
            .then((r) => (r.data || []).map((c) => ({ ...c, businessName: b.name })))
            .catch(() => [])
        )
      );
      setCampaigns(results.flat());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiRequest(`/businesses/${form.business_id}/ads/campaigns`, {
        method: 'POST',
        body: {
          name: form.name,
          objective: form.objective,
          daily_budget: form.daily_budget ? Number(form.daily_budget) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        },
      });
      const bizName = businesses.find((b) => b.id === form.business_id)?.name;
      setCampaigns((prev) => [{ ...res.data, businessName: bizName }, ...prev]);
      setForm((f) => ({ ...f, name: '', daily_budget: '', start_date: '', end_date: '' }));
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(campaign) {
    const next = campaign.status === 'paused' ? 'active' : 'paused';
    try {
      const res = await apiRequest(`/ads/campaigns/${campaign.id}`, { method: 'PATCH', body: { status: next } });
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? { ...c, ...res.data } : c)));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

  return (
    <main className="min-h-screen px-8 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Ads Manager</h1>
        {businesses.length > 0 && (
          <button onClick={() => setShowForm((s) => !s)} className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium">
            {showForm ? 'Cancel' : '+ New campaign'}
          </button>
        )}
      </div>
      <p className="text-neutral-500 text-sm mb-6">Plan and track your ad campaigns manually.</p>

      <div className="border border-dashed border-neutral-800 rounded-xl p-4 mb-8 text-sm text-neutral-500">
        📣 These campaigns are tracked here for planning. They won't run on Facebook/Instagram automatically until you connect your Meta account (not set up yet).
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="border border-neutral-800 rounded-xl p-6 space-y-4 mb-8">
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Business</label>
            <select
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
              value={form.business_id}
              onChange={(e) => setForm({ ...form, business_id: e.target.value })}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-neutral-400 block mb-1">Campaign name</label>
            <input
              required
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Summer skincare offer"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-neutral-400 block mb-1">Objective</label>
              <select
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
              >
                {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-400 block mb-1">Daily budget (₹)</label>
              <input
                type="number"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                value={form.daily_budget}
                onChange={(e) => setForm({ ...form, daily_budget: e.target.value })}
                placeholder="500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-neutral-400 block mb-1">Start date</label>
              <input
                type="date"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400 block mb-1">End date</label>
              <input
                type="date"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium disabled:opacity-50">
            {saving ? 'Creating…' : 'Create campaign'}
          </button>
        </form>
      )}

      {campaigns.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-xl p-10 text-center text-neutral-400">
          No campaigns yet. Click "+ New campaign" to plan your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="border border-neutral-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{c.businessName} · {c.objective}</div>
                </div>
                <span className={`text-xs font-mono uppercase px-2.5 py-1 rounded ${STATUS_COLORS[c.status] || 'bg-neutral-800 text-neutral-400'}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-400 mt-3">
                <span>{c.daily_budget ? `₹${c.daily_budget}/day` : 'No budget set'}</span>
                {(c.status === 'active' || c.status === 'paused') && (
                  <button onClick={() => toggleStatus(c)} className="text-orange-400 hover:text-orange-300 text-sm font-medium">
                    {c.status === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
