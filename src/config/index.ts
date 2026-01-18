import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  adminPort: parseInt(process.env.ADMIN_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  superAdminToken: process.env.SUPER_ADMIN_TOKEN || 'super-admin-token',
  adminToken: process.env.ADMIN_TOKEN || 'admin-token',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // Microsoft Graph (Teams)
  msGraph: {
    clientId: process.env.MS_GRAPH_CLIENT_ID || '',
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET || '',
    tenantId: process.env.MS_GRAPH_TENANT_ID || '',
  },

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '/api/oauth/google/callback',

  // Microsoft OAuth (Azure AD)
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  microsoftCallbackUrl: process.env.MICROSOFT_CALLBACK_URL || '/api/oauth/microsoft/callback',

  // Apple OAuth
  appleClientId: process.env.APPLE_CLIENT_ID || '',
  appleTeamId: process.env.APPLE_TEAM_ID || '',
  appleKeyId: process.env.APPLE_KEY_ID || '',
  applePrivateKey: process.env.APPLE_PRIVATE_KEY || '',
  appleCallbackUrl: process.env.APPLE_CALLBACK_URL || '/api/oauth/apple/callback',

  // Bcrypt
  bcryptRounds: 12,
};

export default config;
