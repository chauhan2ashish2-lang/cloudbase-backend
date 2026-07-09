'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ agencyName: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiRequest('/auth/register', { method: 'POST', body: form });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold mb-6">Create your account</h1>

        {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}

        <input
          className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 focus:border-orange-500 outline-none"
          placeholder="Business / Agency name"
          value={form.agencyName}
          onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
          required
        />
        <input
          className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 focus:border-orange-500 outline-none"
          placeholder="Your full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          type="email"
          className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 focus:border-orange-500 outline-none"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 focus:border-orange-500 outline-none"
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium transition disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-sm text-neutral-500 text-center">
          Already have an account? <Link href="/login" className="text-orange-400">Log in</Link>
        </p>
      </form>
    </main>
  );
}
