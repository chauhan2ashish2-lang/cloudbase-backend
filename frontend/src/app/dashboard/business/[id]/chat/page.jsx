'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function BusinessChatPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.id;

  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your AI marketing assistant. Ask me to generate posts or content for this business, and I'll get it done." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setSending(true);

    try {
      const res = await apiRequest(`/businesses/${businessId}/chat`, {
        method: 'POST',
        body: { message: text },
      });
      const { agent, result, note } = res.data;

      if (agent === 'content' && Array.isArray(result) && result.length > 0) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: `Here are ${result.length} post${result.length > 1 ? 's' : ''} I generated:`, posts: result },
        ]);
      } else if (note) {
        setMessages((m) => [...m, { role: 'assistant', text: `The "${agent}" agent isn't built yet — ${note}` }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', text: "I wasn't able to generate a result for that. Try asking me to generate content or posts." }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col max-w-3xl mx-auto px-6 py-8">
      <Link href={`/dashboard/business/${businessId}`} className="text-sm text-neutral-500 hover:text-neutral-300 mb-4 inline-block">
        ← Back to business
      </Link>
      <h1 className="text-2xl font-bold mb-6">AI Chat Agent</h1>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ maxHeight: '60vh' }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-[15px] leading-relaxed ${
              m.role === 'user' ? 'bg-orange-500 text-white' : 'bg-neutral-900 border border-neutral-800 text-neutral-200'
            }`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.posts && (
                <div className="mt-3 space-y-3">
                  {m.posts.map((post) => (
                    <div key={post.id} className="border border-neutral-800 rounded-lg p-3 bg-black/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${post.platform === 'instagram' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'}`}>
                          {post.platform}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono uppercase">{post.category}</span>
                      </div>
                      <p className="whitespace-pre-wrap mb-2">{post.caption}</p>
                      <p className="text-sm text-blue-400 mb-2">{(post.hashtags || []).map((h) => `#${h}`).join('  ')}</p>
                      <div className="text-sm text-green-400 font-mono pt-2 border-t border-neutral-800">→ {post.cta}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-500 text-sm">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-3 border-t border-neutral-800 pt-4">
        <input
          className="flex-1 px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 outline-none"
          placeholder="e.g. Generate 3 Instagram posts about our summer offer"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium disabled:opacity-50">
          Send
        </button>
      </form>
    </main>
  );
}
