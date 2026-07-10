import axios from 'axios';
import { env } from '../config/env.js';

const GRAPH_BASE = `https://graph.facebook.com/${env.meta.graphApiVersion}`;

const client = axios.create({ baseURL: GRAPH_BASE, timeout: 15000 });

/** Step 1: exchange the short-lived user access token (from the FB JS SDK login
 *  dialog on the frontend) for a long-lived (60-day) user access token. */
export async function exchangeForLongLivedToken(shortLivedToken) {
  const { data } = await client.get('/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: env.meta.appId,
      client_secret: env.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });
  return data.access_token; // long-lived user token, ~60 days
}

/** Step 2: list Facebook Pages the user manages, with their (non-expiring)
 *  Page Access Tokens. */
export async function listManagedPages(userAccessToken) {
  const { data } = await client.get('/me/accounts', {
    params: { access_token: userAccessToken, fields: 'id,name,access_token,category' },
  });
  return data.data; // [{ id, name, access_token, category }]
}

/** Step 3: given a Page, fetch its linked Instagram Business Account. */
export async function getInstagramBusinessAccount(pageId, pageAccessToken) {
  const { data } = await client.get(`/${pageId}`, {
    params: { access_token: pageAccessToken, fields: 'instagram_business_account{id,username}' },
  });
  return data.instagram_business_account || null;
}

/** List ad accounts accessible to the user (for the Ads module). */
export async function listAdAccounts(userAccessToken) {
  const { data } = await client.get('/me/adaccounts', {
    params: { access_token: userAccessToken, fields: 'id,name,account_status,currency,timezone_name' },
  });
  return data.data;
}

/** Publish a feed post to a Facebook Page. */
export async function publishFacebookPost(pageId, pageAccessToken, { message, link, imageUrl }) {
  if (imageUrl) {
    const { data } = await client.post(`/${pageId}/photos`, null, {
      params: { access_token: pageAccessToken, caption: message, url: imageUrl },
    });
    return data; // { id, post_id }
  }
  const { data } = await client.post(`/${pageId}/feed`, null, {
    params: { access_token: pageAccessToken, message, link },
  });
  return data; // { id }
}

/** Publish an image/reel to Instagram: two-step container + publish flow. */
export async function publishInstagramMedia(igBusinessId, pageAccessToken, { imageUrl, videoUrl, caption, isReel }) {
  const containerParams = {
    access_token: pageAccessToken,
    caption,
    ...(isReel ? { media_type: 'REELS', video_url: videoUrl } : { image_url: imageUrl }),
  };
  const { data: container } = await client.post(`/${igBusinessId}/media`, null, { params: containerParams });

  // Poll container status until FINISHED (required for video/reels)
  if (isReel) {
    await pollContainerStatus(container.id, pageAccessToken);
  }

  const { data: published } = await client.post(`/${igBusinessId}/media_publish`, null, {
    params: { access_token: pageAccessToken, creation_id: container.id },
  });
  return published; // { id }
}

async function pollContainerStatus(containerId, pageAccessToken, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await client.get(`/${containerId}`, {
      params: { access_token: pageAccessToken, fields: 'status_code' },
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Media container processing failed');
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Timed out waiting for media container to finish processing');
}

/** Fetch Page-level insights (followers, reach, impressions, engagement). */
export async function getPageInsights(pageId, pageAccessToken, metrics, period = 'day') {
  const { data } = await client.get(`/${pageId}/insights`, {
    params: { access_token: pageAccessToken, metric: metrics.join(','), period },
  });
  return data.data;
}

/** Fetch Instagram Business Account insights. */
export async function getInstagramInsights(igBusinessId, pageAccessToken, metrics, period = 'day') {
  const { data } = await client.get(`/${igBusinessId}/insights`, {
    params: { access_token: pageAccessToken, metric: metrics.join(','), period },
  });
  return data.data;
}

export async function subscribeWebhooks(pageId, pageAccessToken) {
  await client.post(`/${pageId}/subscribed_apps`, null, {
    params: { access_token: pageAccessToken, subscribed_fields: 'feed,mention,comments' },
  });
}
