import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireBusinessAccess } from '../middleware/auth.js';
import { encryptToken } from '../services/encryptionService.js';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import * as meta from '../services/metaGraphService.js';

const router = Router();
router.get('/businesses/:businessId/status', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, fb_page_id, fb_page_name, ig_business_id, ig_username, status, connected_at
       FROM meta_connections WHERE business_id = $1 AND status = 'connected'
       ORDER BY connected_at DESC LIMIT 1`,
      [req.business.id]
    );
    res.json({ data: rows[0] || null });
  } catch (err) { next(err); }
});

/**
 * Frontend flow:
 * 1. Frontend uses the Facebook JS SDK to open the Business Login dialog and
 *    obtains a short-lived user access token directly from Meta.
 * 2. Frontend POSTs that token here along with the businessId it's connecting.
 * 3. Backend exchanges it for a long-lived token and returns the list of
 *    manageable Pages for the user to pick from.
 */
router.post('/oauth/exchange', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { shortLivedToken } = req.body;
    const longLivedToken = await meta.exchangeForLongLivedToken(shortLivedToken);
    const pages = await meta.listManagedPages(longLivedToken);
    const adAccounts = await meta.listAdAccounts(longLivedToken);

    // Stash the long-lived user token briefly (encrypted) so /connect can use it
    // without re-prompting the user. In production, use a short-TTL Redis key
    // keyed by userId instead of round-tripping it through the client.
    res.json({
      pages: pages.map((p) => ({ id: p.id, name: p.name, category: p.category })),
      adAccounts,
      userAccessToken: longLivedToken, // sent back to client, resubmitted to /connect
    });
  } catch (err) {
    next(err);
  }
});

router.post('/connect', requireAuth, requireBusinessAccess, async (req, res, next) => {
  try {
    const { pageId, userAccessToken, adAccountId } = req.body;

    const pages = await meta.listManagedPages(userAccessToken);
    const selected = pages.find((p) => p.id === pageId);
    if (!selected) {
      return res.status(400).json({ error: { code: 'PAGE_NOT_FOUND', message: 'Page not accessible with this token' } });
    }

    const igAccount = await meta.getInstagramBusinessAccount(pageId, selected.access_token);

    await meta.subscribeWebhooks(pageId, selected.access_token);

    const result = await query(
      `INSERT INTO meta_connections
        (business_id, fb_page_id, fb_page_name, ig_business_id, ig_username, ad_account_id,
         page_access_token_enc, user_access_token_enc, scopes, status, connected_at, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'connected',now(),NULL)
       ON CONFLICT (business_id, fb_page_id) DO UPDATE SET
         page_access_token_enc = EXCLUDED.page_access_token_enc,
         user_access_token_enc = EXCLUDED.user_access_token_enc,
         status = 'connected'
       RETURNING id`,
      [
        req.business.id,
        pageId,
        selected.name,
        igAccount?.id || null,
        igAccount?.username || null,
        adAccountId || null,
        encryptToken(selected.access_token),
        encryptToken(userAccessToken),
        ['pages_manage_posts', 'instagram_content_publish', 'ads_management', 'read_insights'],
      ]
    );

    res.status(201).json({ connectionId: result.rows[0].id, page: selected.name, instagram: igAccount });
  } catch (err) {
    next(err);
  }
});

router.delete('/connections/:connectionId', requireAuth, async (req, res, next) => {
  try {
    await query(
      `UPDATE meta_connections SET status = 'revoked'
       WHERE id = $1 AND business_id IN (SELECT id FROM businesses WHERE agency_id = $2)`,
      [req.params.connectionId, req.auth.agencyId]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------
// Webhooks (public, signature-verified — NOT behind requireAuth)
// ---------------------------------------------------------------------

router.get('/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.meta.webhookVerifyToken) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post('/webhooks/meta', verifyMetaSignature, async (req, res) => {
  // Enqueue for async processing; ack immediately per Meta's requirements.
  res.sendStatus(200);
  // TODO: push req.body onto a BullMQ queue for feed/comment/mention handling
});

router.get('/webhooks/meta/data-deletion', (req, res) => res.sendStatus(200));

router.post('/webhooks/meta/data-deletion', verifyMetaSignature, async (req, res) => {
  // Required by Meta App Review: honor user data deletion requests.
  // Parse signed_request, locate the associated business/connection, purge data,
  // and return a confirmation URL + code per Meta's spec.
  res.json({
    url: `${env.frontendUrl}/data-deletion-status`,
    confirmation_code: crypto.randomBytes(8).toString('hex'),
  });
});

function verifyMetaSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return res.sendStatus(401);
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.meta.appSecret).update(req.rawBody || '').digest('hex');
  if (signature !== expected) return res.sendStatus(401);
  next();
}

export default router;
