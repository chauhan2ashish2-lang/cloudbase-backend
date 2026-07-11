import { Router } from 'express';
import { requireAuth, requireBusinessAccess } from '../middleware/auth.js';
import { query } from '../config/db.js';

const router = Router();

// GET /businesses/:businessId/ads/campaigns
router.get('/businesses/:businessId/ads/campaigns', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM ad_campaigns WHERE business_id = $1 ORDER BY created_at DESC',
      [req.business.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /businesses/:businessId/ads/campaigns
router.post('/businesses/:businessId/ads/campaigns', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { name, objective, daily_budget, start_date, end_date } = req.body;
    if (!name || !objective) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and objective are required' } });
    }
    const { rows } = await query(
      `INSERT INTO ad_campaigns (business_id, name, objective, daily_budget, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.business.id, name, objective, daily_budget || null, start_date || null, end_date || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /ads/campaigns/:id
router.patch('/ads/campaigns/:id', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['name', 'objective', 'status', 'daily_budget', 'lifetime_budget', 'start_date', 'end_date'];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No valid fields to update' } });

    const setClause = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = updates.map(([, v]) => v);

    const { rows } = await query(
      `UPDATE ad_campaigns SET ${setClause} WHERE id = $1
       AND business_id IN (SELECT id FROM businesses WHERE agency_id = $${values.length + 2})
       RETURNING *`,
      [req.params.id, ...values, req.auth.agencyId]
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

export default router;
