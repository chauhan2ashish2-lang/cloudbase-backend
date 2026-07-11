import { Router } from 'express';
import { requireAuth, requireBusinessAccess } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { generateContentBatch } from '../agents/contentAgent.js';
import { queues } from '../jobs/queue.js';

const router = Router({ mergeParams: true });

// GET /businesses/:businessId/content/posts
router.get('/businesses/:businessId/content/posts', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { status, platform } = req.query;
    const conditions = ['business_id = $1'];
    const params = [req.business.id];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (platform) { params.push(platform); conditions.push(`platform = $${params.length}`); }

    const { rows } = await query(
      `SELECT * FROM content_posts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /businesses/:businessId/content/generate
router.post('/businesses/:businessId/content/generate', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const strategyResult = await query(
      'SELECT * FROM marketing_strategies WHERE business_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1',
      [req.business.id]
    );
    const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [req.business.id]);

    const posts = await generateContentBatch({
      business: businessResult.rows[0],
      strategy: strategyResult.rows[0],
      count: req.body.count,
      categories: req.body.categories,
    });

    if (businessResult.rows[0].onboarding_status === 'pending') {
      await query(`UPDATE businesses SET onboarding_status = 'active' WHERE id = $1`, [req.business.id]);
    }

    res.status(201).json({ data: posts });
  } catch (err) { next(err); }
});

// PATCH /content/posts/:id
router.patch('/content/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['caption', 'hashtags', 'cta', 'scheduled_at', 'status'];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No valid fields to update' } });

    const setClause = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = updates.map(([, v]) => v);

    const { rows } = await query(
      `UPDATE content_posts SET ${setClause} WHERE id = $1
       AND business_id IN (SELECT id FROM businesses WHERE agency_id = $${values.length + 2})
       RETURNING *`,
      [req.params.id, ...values, req.auth.agencyId]
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// POST /content/posts/:id/approve
router.post('/content/posts/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE content_posts SET status = 'approved', approved_by = $2 WHERE id = $1
       AND business_id IN (SELECT id FROM businesses WHERE agency_id = $3) RETURNING *`,
      [req.params.id, req.auth.userId, req.auth.agencyId]
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });

    // If it already has a scheduled_at in the future, mark scheduled and let the
    // cron-based scheduler pick it up; otherwise leave as approved for manual scheduling.
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// POST /content/posts/:id/publish-now
router.post('/content/posts/:id/publish-now', requireAuth, async (req, res, next) => {
  try {
    await queues.publish.add('publish-post', { postId: req.params.id });
    res.status(202).json({ message: 'Publish job queued' });
  } catch (err) { next(err); }
});

export default router;
