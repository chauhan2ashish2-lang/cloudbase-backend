import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireBusinessAccess } from '../middleware/auth.js';
import { query } from '../config/db.js';

const router = Router();

router.get('/businesses', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, industry, onboarding_status, created_at FROM businesses WHERE agency_id = $1 ORDER BY created_at DESC',
      [req.auth.agencyId]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

const createSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  industry: z.string().optional(),
  productsServices: z.string().optional(),
  targetAudience: z.string().optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  marketingGoals: z.array(z.string()).optional(),
  monthlyAdBudget: z.number().optional(),
});

router.post('/businesses', requireAuth, async (req, res, next) => {
  try {
    const b = createSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO businesses
        (agency_id, name, website_url, industry, products_services, target_audience, country, language, marketing_goals, monthly_ad_budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.auth.agencyId, b.name, b.websiteUrl, b.industry, b.productsServices,
        b.targetAudience, b.country, b.language || 'en', b.marketingGoals || [], b.monthlyAdBudget,
      ]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { next(err); }
});

router.get('/businesses/:id', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM businesses WHERE id = $1', [req.business.id]);
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

export default router;
