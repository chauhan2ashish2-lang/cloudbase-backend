import { Router } from 'express';
import { requireAuth, requireBusinessAccess } from '../middleware/auth.js';
import { query } from '../config/db.js';
import { handleChatMessage } from '../agents/orchestrator.js';

const router = Router();

// POST /businesses/:businessId/chat
router.post('/businesses/:businessId/chat', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: { code: 'MISSING_MESSAGE', message: 'Message is required' } });
    }

    const businessResult = await query('SELECT * FROM businesses WHERE id = $1', [req.business.id]);
    const strategyResult = await query(
      'SELECT * FROM marketing_strategies WHERE business_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1',
      [req.business.id]
    );

    const outcome = await handleChatMessage({
      business: businessResult.rows[0],
      strategy: strategyResult.rows[0],
      message,
    });

    res.json({ data: outcome });
  } catch (err) { next(err); }
});

export default router;
