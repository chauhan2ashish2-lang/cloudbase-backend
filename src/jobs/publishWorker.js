import { Worker } from 'bullmq';
import { connection } from './queue.js';
import { query } from '../config/db.js';
import { decryptToken } from '../services/encryptionService.js';
import * as meta from '../services/metaGraphService.js';

export const publishWorker = new Worker(
  'publish',
  async (job) => {
    const { postId } = job.data;
    const { rows } = await query(
      `SELECT p.*, mc.fb_page_id, mc.ig_business_id, mc.page_access_token_enc
       FROM content_posts p
       JOIN meta_connections mc ON mc.business_id = p.business_id AND mc.status = 'connected'
       WHERE p.id = $1`,
      [postId]
    );
    const post = rows[0];
    if (!post) throw new Error(`Post ${postId} not found or no active Meta connection`);

    const pageAccessToken = decryptToken(post.page_access_token_enc);
    const mediaUrl = post.media_urls?.[0]?.url;
    let result;

    try {
      if (post.platform === 'facebook') {
        result = await meta.publishFacebookPost(post.fb_page_id, pageAccessToken, {
          message: `${post.caption}\n\n${(post.hashtags || []).map((h) => `#${h}`).join(' ')}`,
          imageUrl: mediaUrl,
        });
      } else if (post.platform === 'instagram') {
        result = await meta.publishInstagramMedia(post.ig_business_id, pageAccessToken, {
          imageUrl: post.post_type !== 'reel' ? mediaUrl : undefined,
          videoUrl: post.post_type === 'reel' ? mediaUrl : undefined,
          isReel: post.post_type === 'reel',
          caption: `${post.caption}\n\n${(post.hashtags || []).map((h) => `#${h}`).join(' ')}`,
        });
      }

      await query(
        `UPDATE content_posts SET status = 'published', published_at = now(), meta_post_id = $2 WHERE id = $1`,
        [postId, result.id || result.post_id]
      );
    } catch (err) {
      await query(
        `UPDATE content_posts SET status = 'failed', error_message = $2 WHERE id = $1`,
        [postId, err.message]
      );
      throw err;
    }
  },
  { connection }
);

publishWorker.on('failed', (job, err) => {
  console.error(`[publishWorker] Job ${job.id} failed:`, err.message);
});
