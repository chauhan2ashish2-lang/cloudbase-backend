import dotenv from 'dotenv';
dotenv.config();

function required(name) {
  const val = process.env[name];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,

  encryptionKey: required('TOKEN_ENCRYPTION_KEY'), // 32-byte hex key for AES-256-GCM

  meta: {
    appId: required('META_APP_ID'),
    appSecret: required('META_APP_SECRET'),
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:4000/api/v1/meta/oauth/callback',
    graphApiVersion: process.env.META_GRAPH_VERSION || 'v19.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },

  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    defaultModel: process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-6',
  },

  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
