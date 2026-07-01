const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT || 3000;

// ── AAPKI SUPABASE DETAILS (already set) ──
const SB_URL = process.env.SUPABASE_URL || 'https://ufbllgntaxaubahjwvxb.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmYmxsZ250YXhhdWJhaGp3dnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDUxMTMsImV4cCI6MjA5ODEyMTExM30.zjX1JjJ66B9gZalGrYuO1Wx3lJsdOdVchryQt9zpvdc';

// ── IN ENVIRONMENT VARIABLES MEIN DAALO (Railway dashboard mein) ──
const CLAUDE_KEY = process.env.ANTHROPIC_KEY || '';
const WA_TOKEN = process.env.WA_TOKEN || '';
const WA_PHONE_ID = process.env.WA_PHONE_ID || '';
const WA_VERIFY = process.env.WA_VERIFY_TOKEN || 'cloudbase2024';
const RZ_KEY = process.env.RAZORPAY_KEY || '';
const RZ_SECRET = process.env.RAZORPAY_SECRET || '';
const PP_MID = process.env.PHONEPE_MID || '';
const PP_SALT = process.env.PHONEPE_SALT || '';

// ── SUPABASE ──
function sb(table, method, body, query = '') {
  return new Promise((resolve) => {
    const path = `/rest/v1/${table}${query}`;
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'ufbllgntaxaubahjwvxb.supabase.co',
      path,
      method,
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(opts, r => {
      let d = '';
      r.on('data', x => d += x);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(d || []); }
      });
    });
    req.on('error', e => { console.error('Supabase error:', e.message); resolve([]); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── CLAUDE AI ──
function askClaude(messages, system) {
  return new Promise((resolve) => {
    if (!CLAUDE_KEY) { resolve(fallback(messages.slice(-1)[0]?.content || '')); return; }
    const body = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 300, system, messages });
    const opts = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, r => {
      let d = '';
      r.on('data', x => d += x);
      r.on('end', () => {
        try { resolve(JSON.parse(d).content[0].text); }
        catch { resolve('Kuch problem aayi. Dobara try karein.'); }
      });
    });
    req.on('error', () => resolve('Connection error.'));
    req.write(body); req.end();
  });
}

function fallback(msg) {
  const l = msg.toLowerCase();
  if (l.includes('price') || l.includes('kitna') || l.includes('cost')) return 'Hamare products ki pricing ke liye main aapki help karunga! Kaunsa product chahiye?';
  if (l.includes('payment') || l.includes('pay')) return 'Hum UPI, Credit/Debit card, Net Banking accept karte hain. Safe aur secure! 💳';
  if (l.includes('return') || l.includes('refund')) return '7-din return policy hai. Full refund guaranteed! ✅';
  if (l.includes('human') || l.includes('agent')) return 'Main abhi human agent se connect karta hoon! Thoda wait karein. 👤';
  return 'Shukriya contact karne ke liye! Kaise help kar sakta hoon? 😊';
}

// ── WHATSAPP SEND ──
function sendWA(to, text) {
  return new Promise((resolve) => {
    if (!WA_TOKEN || !WA_PHONE_ID) { resolve(false); return; }
    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: text }
    });
    const opts = {
      hostname: 'graph.facebook.com',
      path: `/v18.0/${WA_PHONE_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, r => { let d = ''; r.on('data', x => d += x); r.on('end', () => resolve(true)); });
    req.on('error', () => resolve(false));
    req.write(body); req.end();
  });
}

// ── UPSERT VISITOR ──
async function upsertVisitor(visitorId, sessionId, page, inc = false) {
  const existing = await sb('visitors', 'GET', null, `?visitor_id=eq.${visitorId}&select=id,msg_count`);
  if (existing && existing.length > 0) {
    const updates = { page, last_seen: new Date().toISOString() };
    if (inc) updates.msg_count = (existing[0].msg_count || 0) + 1;
    await sb('visitors', 'PATCH', updates, `?visitor_id=eq.${visitorId}`);
  } else {
    await sb('visitors', 'POST', {
      visitor_id: visitorId,
      session_id: sessionId,
      page,
      msg_count: inc ? 1 : 0,
      issues: [],
      last_seen: new Date().toISOString()
    });
  }
}

// ── MAIN SERVER ──
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  let body = '';
  req.on('data', d => body += d);
  await new Promise(r => req.on('end', r));
  let data = {};
  try { data = JSON.parse(body); } catch {}

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const j = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  // ── HEALTH ──
  if (p === '/' || p === '/health') {
    return j(200, {
      status: '✅ CloudBase Pro Backend Running!',
      supabase: !!SB_URL,
      claude: !!CLAUDE_KEY,
      whatsapp: !!WA_TOKEN,
      razorpay: !!RZ_KEY,
      phonepe: !!PP_MID,
      version: '2.0'
    });
  }

  // ── CHAT API ──
  if (p === '/chat' && req.method === 'POST') {
    const { message, history = [], visitorId, sessionId, page, bizName, lang, products } = data;
    const system = `Tu ${bizName || 'is business'} ka ${lang || 'Hinglish'} mein baat karne wala friendly AI customer support agent hai. Business products/services: ${products || 'General business'}. Hamesha short replies do (2-3 lines max). Warm aur helpful raho. Payment gateway available hai. 7-din return policy. Complex issue pe human agent escalate karo.`;
    const msgs = [...(history || []).slice(-6), { role: 'user', content: message }];
    const reply = await askClaude(msgs, system);
    // Save to Supabase
    await sb('chats', 'POST', { visitor_id: visitorId, session_id: sessionId, page, message, reply });
    await upsertVisitor(visitorId, sessionId, page || '/', true);
    return j(200, { reply, ok: true });
  }

  // ── TRACK EVENT ──
  if (p === '/track' && req.method === 'POST') {
    const { visitorId, sessionId, page, event } = data;
    await upsertVisitor(visitorId, sessionId, page || '/', false);
    await sb('events', 'POST', { visitor_id: visitorId, session_id: sessionId, page, event });
    if (event === 'payment_failed' || event === 'issue') {
      const v = await sb('visitors', 'GET', null, `?visitor_id=eq.${visitorId}&select=id,issues`);
      if (v && v.length > 0) {
        const issues = [...(v[0].issues || []), { type: event, time: new Date().toISOString() }];
        await sb('visitors', 'PATCH', { issues }, `?visitor_id=eq.${visitorId}`);
      }
    }
    return j(200, { ok: true });
  }

  // ── ADMIN: GET ALL DATA ──
  if (p === '/admin/data' && req.method === 'GET') {
    const [visitors, chats, payments, whatsapp, events] = await Promise.all([
      sb('visitors', 'GET', null, '?order=last_seen.desc&limit=50'),
      sb('chats', 'GET', null, '?order=created_at.desc&limit=200'),
      sb('payments', 'GET', null, '?order=created_at.desc&limit=100'),
      sb('whatsapp_messages', 'GET', null, '?order=created_at.desc&limit=200'),
      sb('events', 'GET', null, '?order=created_at.desc&limit=100')
    ]);
    return j(200, { visitors: visitors || [], chats: chats || [], payments: payments || [], whatsapp: whatsapp || [], events: events || [] });
  }

  // ── ADMIN: SAVE SETTINGS ──
  if (p === '/admin/settings' && req.method === 'POST') {
    await sb('settings', 'PATCH', { data }, '?id=eq.1');
    return j(200, { ok: true });
  }

  // ── ADMIN: GET SETTINGS ──
  if (p === '/admin/settings' && req.method === 'GET') {
    const s = await sb('settings', 'GET', null, '?id=eq.1&select=data');
    return j(200, { settings: s?.[0]?.data || {} });
  }

  // ── ADMIN: SEND REPLY ──
  if (p === '/admin/reply' && req.method === 'POST') {
    const { to, message, channel } = data;
    if (channel === 'whatsapp') {
      const sent = await sendWA(to, message);
      if (sent) await sb('whatsapp_messages', 'POST', { from_number: to, message, direction: 'out' });
    }
    return j(200, { ok: true });
  }

  // ── WHATSAPP WEBHOOK VERIFY ──
  if (p === '/whatsapp-webhook' && req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === WA_VERIFY) {
      res.writeHead(200); res.end(challenge);
    } else {
      res.writeHead(403); res.end('Forbidden');
    }
    return;
  }

  // ── WHATSAPP WEBHOOK RECEIVE ──
  if (p === '/whatsapp-webhook' && req.method === 'POST') {
    try {
      const msg = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (msg && msg.type === 'text') {
        const from = msg.from;
        const text = msg.text.body;
        await sb('whatsapp_messages', 'POST', { from_number: from, message: text, direction: 'in' });
        const reply = await askClaude([{ role: 'user', content: text }], 'Tu helpful customer support AI hai. Hinglish mein baat kar. 2-3 lines mein reply do.');
        await sendWA(from, reply);
        await sb('whatsapp_messages', 'POST', { from_number: from, message: reply, direction: 'out' });
      }
    } catch (e) { console.error('WA webhook error:', e); }
    return j(200, { ok: true });
  }

  // ── RAZORPAY WEBHOOK ──
  if (p === '/razorpay-webhook' && req.method === 'POST') {
    if (RZ_SECRET) {
      const sig = req.headers['x-razorpay-signature'];
      const expected = crypto.createHmac('sha256', RZ_SECRET).update(body).digest('hex');
      if (sig !== expected) return j(400, { error: 'Invalid signature' });
    }
    const pay = data.payload?.payment?.entity;
    if (pay) {
      await sb('payments', 'POST', {
        payment_id: pay.id,
        amount: pay.amount / 100,
        currency: pay.currency || 'INR',
        method: pay.method,
        gateway: 'Razorpay',
        status: data.event === 'payment.captured' ? 'paid' : 'failed',
        customer: pay.email || pay.contact || ''
      });
    }
    return j(200, { ok: true });
  }

  // ── PHONEPE CALLBACK ──
  if (p === '/phonepe-callback' && req.method === 'POST') {
    try {
      const decoded = JSON.parse(Buffer.from(data.response || '{}', 'base64').toString());
      await sb('payments', 'POST', {
        payment_id: decoded.data?.transactionId || 'PP_' + Date.now(),
        amount: (decoded.data?.amount || 0) / 100,
        currency: 'INR',
        method: 'UPI',
        gateway: 'PhonePe',
        status: decoded.success ? 'paid' : 'failed',
        customer: ''
      });
    } catch (e) { console.error('PhonePe error:', e); }
    return j(200, { ok: true });
  }

  return j(404, { error: 'Route not found', path: p });
});

server.listen(PORT, () => {
  console.log('\n ================================================');
  console.log(' ☁️  CloudBase Pro Backend — RUNNING!');
  console.log(` 🌐 Port: ${PORT}`);
  console.log(` 📊 Supabase: ${SB_URL ? '✅ Connected' : '❌ Not set'}`);
  console.log(` 🤖 Claude AI: ${CLAUDE_KEY ? '✅ Ready' : '⚠️  Set ANTHROPIC_KEY'}`);
  console.log(` 📱 WhatsApp: ${WA_TOKEN ? '✅ Ready' : '⚠️  Set WA_TOKEN'}`);
  console.log(` 💳 Razorpay: ${RZ_KEY ? '✅ Ready' : '⚠️  Set RAZORPAY_KEY'}`);
  console.log(` 📲 PhonePe: ${PP_MID ? '✅ Ready' : '⚠️  Set PHONEPE_MID'}`);
  console.log(' ================================================\n');
});
