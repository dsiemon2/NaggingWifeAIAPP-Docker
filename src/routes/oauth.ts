import { Router, Response, Request, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile, VerifyCallback as GoogleVerifyCallback } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import * as userService from '../services/userService.js';
import { logger } from '../utils/logger';
import { generateUserToken } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';

// Microsoft profile type (from passport-oauth2)
interface MicrosoftProfile {
  id: string;
  displayName: string;
  emails?: { value: string }[];
  _json?: {
    mail?: string;
    userPrincipalName?: string;
  };
}

const router = Router();

// Store for pending OAuth state (in production, use Redis or similar)
const oauthStateStore = new Map<string, { groupDomain: string; redirect: string; expires: number }>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStateStore.entries()) {
    if (value.expires < now) {
      oauthStateStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Configure Google OAuth Strategy
if (config.googleClientId && config.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl || '/api/oauth/google/callback',
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: GoogleProfile,
        done: GoogleVerifyCallback
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Try to find existing user by Google ID first
          const user = await userService.findUserByOAuthProvider('google', profile.id);

          if (user) {
            // User exists with this Google account
            return done(null, user as unknown as Express.User);
          }

          // Try to find user by email (across all companies)
          const existingUserByEmail = await userService.findUserByEmailGlobal(email);

          if (existingUserByEmail) {
            // Link Google to existing account
            await userService.linkOAuthProvider(existingUserByEmail.id, 'google', profile.id);
            return done(null, existingUserByEmail as unknown as Express.User);
          }

          // Return profile info - will handle company selection in callback
          // Cast to unknown first to bypass type checking for this intermediate state
          return done(null, {
            profile,
            email,
            needsCompany: true,
          } as unknown as Express.User);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

// Configure Microsoft OAuth Strategy
if (config.microsoftClientId && config.microsoftClientSecret) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: config.microsoftClientId,
        clientSecret: config.microsoftClientSecret,
        callbackURL: config.microsoftCallbackUrl || '/api/oauth/microsoft/callback',
        scope: ['user.read'],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: MicrosoftProfile,
        done: (error: Error | null, user?: Express.User | false) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
          if (!email) {
            return done(new Error('No email found in Microsoft profile'));
          }

          // Try to find existing user by Microsoft ID first
          const user = await userService.findUserByOAuthProvider('microsoft', profile.id);

          if (user) {
            return done(null, user as unknown as Express.User);
          }

          // Try to find user by email
          const existingUserByEmail = await userService.findUserByEmailGlobal(email);

          if (existingUserByEmail) {
            await userService.linkOAuthProvider(existingUserByEmail.id, 'microsoft', profile.id);
            return done(null, existingUserByEmail as unknown as Express.User);
          }

          // Return profile info for company selection
          return done(null, {
            profile,
            email,
            needsCompany: true,
            provider: 'microsoft',
          } as unknown as Express.User);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

/**
 * GET /api/oauth/google
 * Initiate Google OAuth flow
 */
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const { groupDomain, redirect } = req.query;

  if (!groupDomain) {
    res.status(400).json({ success: false, error: 'groupDomain query parameter required' });
    return;
  }

  // Generate state token
  const stateToken = Buffer.from(Date.now().toString() + Math.random().toString()).toString('base64');

  // Store state for verification
  oauthStateStore.set(stateToken, {
    groupDomain: groupDomain as string,
    redirect: (redirect as string) || '/admin/dashboard',
    expires: Date.now() + 600000, // 10 minutes
  });

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: stateToken,
  })(req, res, next);
});

/**
 * GET /api/oauth/google/callback
 * Google OAuth callback handler
 */
router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', { session: false }, async (err: Error | null, user: unknown) => {
      if (err) {
        logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Google OAuth error:');
        return res.redirect(`/auth/login?error=${encodeURIComponent(err.message)}`);
      }

      if (!user) {
        return res.redirect('/auth/login?error=Authentication+failed');
      }

      // Retrieve state
      const stateToken = req.query.state as string;
      const storedState = oauthStateStore.get(stateToken);
      oauthStateStore.delete(stateToken); // Clean up

      const redirectUrl = storedState?.redirect || '/admin/dashboard';

      // Check if user needs group assignment
      const userData = user as {
        profile?: GoogleProfile;
        email?: string;
        needsCompany?: boolean;
        id?: string;
        groupId?: string;
        role?: string;
      };

      if (userData.needsCompany && userData.profile && userData.email) {
        // Need to create user with group
        if (!storedState?.groupDomain) {
          return res.redirect('/auth/login?error=Group+domain+required');
        }

        const group = await prisma.group.findUnique({
          where: { domain: storedState.groupDomain.toLowerCase() },
        });

        if (!group || !group.isActive) {
          return res.redirect('/auth/login?error=Group+not+found+or+inactive');
        }

        // Create new user
        try {
          const newUser = await prisma.user.create({
            data: {
              email: userData.email.toLowerCase(),
              name: userData.profile.displayName || userData.email.split('@')[0],
              password: '', // No password for OAuth users
              role: 'MEMBER',
              groupId: group.id,
              googleId: userData.profile.id,
              emailVerified: true,
            },
          });

          const token = generateUserToken({
            userId: newUser.id,
            email: newUser.email,
            name: newUser.name,
            groupId: newUser.groupId,
            role: newUser.role as 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'PARTNER' | 'MEMBER',
            birthDate: null,
          });

          return res.redirect(`${redirectUrl}?token=${token}`);
        } catch (createError) {
          logger.error({ error: createError instanceof Error ? createError.message : String(createError) }, 'Error creating OAuth user:');
          return res.redirect('/auth/login?error=Failed+to+create+account');
        }
      }

      // User already exists
      const authUser = userData as {
        id: string;
        email: string;
        name: string;
        groupId: string;
        role: string;
        birthDate?: Date | null;
      };

      const token = generateUserToken({
        userId: authUser.id,
        email: authUser.email,
        name: authUser.name,
        groupId: authUser.groupId,
        role: authUser.role as 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'PARTNER' | 'MEMBER',
        birthDate: authUser.birthDate?.toISOString() || null,
      });

      res.redirect(`${redirectUrl}?token=${token}`);
    })(req, res, next);
  }
);

/**
 * GET /api/oauth/google/status
 * Check if Google OAuth is configured
 */
router.get('/google/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: !!(config.googleClientId && config.googleClientSecret),
    },
  });
});

/**
 * GET /api/oauth/microsoft
 * Initiate Microsoft OAuth flow
 */
router.get('/microsoft', (req: Request, res: Response, next: NextFunction) => {
  const { groupDomain, redirect } = req.query;

  if (!groupDomain) {
    res.status(400).json({ success: false, error: 'groupDomain query parameter required' });
    return;
  }

  // Generate state token
  const stateToken = Buffer.from(Date.now().toString() + Math.random().toString()).toString('base64');

  // Store state for verification
  oauthStateStore.set(stateToken, {
    groupDomain: groupDomain as string,
    redirect: (redirect as string) || '/admin/dashboard',
    expires: Date.now() + 600000,
  });

  passport.authenticate('microsoft', {
    state: stateToken,
  })(req, res, next);
});

/**
 * GET /api/oauth/microsoft/callback
 * Microsoft OAuth callback handler
 */
router.get(
  '/microsoft/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('microsoft', { session: false }, async (err: Error | null, user: unknown) => {
      if (err) {
        logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Microsoft OAuth error:');
        return res.redirect(`/auth/login?error=${encodeURIComponent(err.message)}`);
      }

      if (!user) {
        return res.redirect('/auth/login?error=Authentication+failed');
      }

      // Retrieve state
      const stateToken = req.query.state as string;
      const storedState = oauthStateStore.get(stateToken);
      oauthStateStore.delete(stateToken);

      const redirectUrl = storedState?.redirect || '/admin/dashboard';

      // Check if user needs group assignment
      const userData = user as {
        profile?: MicrosoftProfile;
        email?: string;
        needsCompany?: boolean;
        provider?: string;
        id?: string;
        groupId?: string;
        role?: string;
      };

      if (userData.needsCompany && userData.profile && userData.email) {
        if (!storedState?.groupDomain) {
          return res.redirect('/auth/login?error=Group+domain+required');
        }

        const group = await prisma.group.findUnique({
          where: { domain: storedState.groupDomain.toLowerCase() },
        });

        if (!group || !group.isActive) {
          return res.redirect('/auth/login?error=Group+not+found+or+inactive');
        }

        try {
          const newUser = await prisma.user.create({
            data: {
              email: userData.email.toLowerCase(),
              name: userData.profile.displayName || userData.email.split('@')[0],
              password: '',
              role: 'MEMBER',
              groupId: group.id,
              microsoftId: userData.profile.id,
              emailVerified: true,
            },
          });

          const token = generateUserToken({
            userId: newUser.id,
            email: newUser.email,
            name: newUser.name,
            groupId: newUser.groupId,
            role: newUser.role as 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'PARTNER' | 'MEMBER',
            birthDate: null,
          });

          return res.redirect(`${redirectUrl}?token=${token}`);
        } catch (createError) {
          logger.error({ error: createError instanceof Error ? createError.message : String(createError) }, 'Error creating OAuth user:');
          return res.redirect('/auth/login?error=Failed+to+create+account');
        }
      }

      // User already exists
      const authUser = userData as {
        id: string;
        email: string;
        name: string;
        groupId: string;
        role: string;
        birthDate?: Date | null;
      };

      const token = generateUserToken({
        userId: authUser.id,
        email: authUser.email,
        name: authUser.name,
        groupId: authUser.groupId,
        role: authUser.role as 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'PARTNER' | 'MEMBER',
        birthDate: authUser.birthDate?.toISOString() || null,
      });

      res.redirect(`${redirectUrl}?token=${token}`);
    })(req, res, next);
  }
);

/**
 * GET /api/oauth/microsoft/status
 * Check if Microsoft OAuth is configured
 */
router.get('/microsoft/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: !!(config.microsoftClientId && config.microsoftClientSecret),
    },
  });
});

/**
 * GET /api/oauth/apple/status
 * Check if Apple OAuth is configured
 */
router.get('/apple/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: !!(config.appleClientId && config.appleTeamId),
    },
  });
});

export default router;
