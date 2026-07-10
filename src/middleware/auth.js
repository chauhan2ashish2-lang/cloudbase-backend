import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: { code: 'NO_TOKEN', message: 'Missing access token' } });

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.auth = { userId: payload.sub, agencyId: payload.agencyId, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    }
    next();
  };
}

// Ensures the :businessId in the route belongs to the caller's agency,
// and (for client_viewer role) that the user is explicitly linked to it.
export async function requireBusinessAccess(req, res, next) {
  const businessId = req.params.businessId || req.params.id || req.body.businessId;
  if (!businessId) return res.status(400).json({ error: { code: 'MISSING_BUSINESS_ID', message: 'businessId required' } });

  const { rows } = await query(
    'SELECT id, agency_id FROM businesses WHERE id = $1 AND agency_id = $2',
    [businessId, req.auth.agencyId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Business not found' } });
  }

  if (req.auth.role === 'client_viewer') {
    const link = await query(
      'SELECT 1 FROM business_users WHERE business_id = $1 AND user_id = $2',
      [businessId, req.auth.userId]
    );
    if (link.rows.length === 0) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this business' } });
    }
  }

  req.business = rows[0];
  next();
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, agencyId: user.agency_id, role: user.role },
    env.jwtAccessSecret,
    { expiresIn: env.accessTokenTtl }
  );
}
