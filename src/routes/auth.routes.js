import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { signAccessToken } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  agencyName: z.string().min(1),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName, agencyName } = registerSchema.parse(req.body);

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } });
    }

    const slug = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
    const agency = await query(
      'INSERT INTO agencies (name, slug) VALUES ($1, $2) RETURNING id',
      [agencyName, slug]
    );

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await query(
      `INSERT INTO users (agency_id, email, password_hash, full_name, role, auth_provider, email_verified_at)
       VALUES ($1, $2, $3, $4, 'owner', 'email', NULL)
       RETURNING id, agency_id, email, full_name, role`,
      [agency.rows[0].id, email, passwordHash, fullName]
    );

    // Default free subscription
    await query(
      `INSERT INTO subscriptions (agency_id, plan, status) VALUES ($1, 'free', 'active')`,
      [agency.rows[0].id]
    );

    const accessToken = signAccessToken(user.rows[0]);
    const refreshToken = await issueRefreshToken(user.rows[0].id);

    res.status(201).json({ user: user.rows[0], accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await query(
      'SELECT id, agency_id, email, full_name, role, password_hash FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);
    delete user.password_hash;

    res.json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: { code: 'MISSING_TOKEN', message: 'refreshToken required' } });

    let payload;
    try {
      payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    } catch {
      return res.status(401).json({ error: { code: 'INVALID_REFRESH', message: 'Invalid refresh token' } });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await query(
      `SELECT rt.id, u.id as user_id, u.agency_id, u.role
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
      [tokenHash]
    );
    if (stored.rows.length === 0) {
      return res.status(401).json({ error: { code: 'REVOKED_TOKEN', message: 'Refresh token revoked or expired' } });
    }

    const user = stored.rows[0];
    const accessToken = signAccessToken({ id: user.user_id, agency_id: user.agency_id, role: user.role });
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash]);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

async function issueRefreshToken(userId) {
  const refreshToken = jwt.sign({ sub: userId }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
  });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
  return refreshToken;
}

export default router;

// NOTE: Google/Facebook OAuth login (user identity) would be wired here via
// Passport strategies (passport-google-oauth20, passport-facebook), mapping
// the provider profile to a `users` row keyed by (auth_provider, provider_user_id).
// This is distinct from the Meta *Business* OAuth flow in meta.routes.js, which
// requests Page/Ads permissions rather than basic login identity.
