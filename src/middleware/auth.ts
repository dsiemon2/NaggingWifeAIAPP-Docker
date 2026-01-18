import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticatedRequest, JwtPayload, Role } from '../types/index.js';
import { prisma } from '../db/prisma.js';

/**
 * Middleware to authenticate users via JWT token
 * Supports: Authorization header, cookie, or query param
 */
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from various sources
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.token || req.query.token as string;

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Verify JWT token
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (!payload.userId) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        groupId: true,
        birthDate: true,
        group: {
          select: {
            id: true,
            name: true,
            isActive: true,
          }
        }
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: 'Account disabled or not found' });
      return;
    }

    // For non-SUPER_ADMIN, check group is active
    if (user.role !== 'SUPER_ADMIN' && user.group && !user.group.isActive) {
      res.status(401).json({ success: false, error: 'Group account is disabled' });
      return;
    }

    // Set user on request
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      groupId: user.groupId,
      birthDate: user.birthDate?.toISOString() || null,
    };
    req.groupId = user.groupId;

    // Backwards compatibility
    if (user.role === 'SUPER_ADMIN') {
      req.superAdmin = req.user;
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Middleware for admin panel pages - redirects to login if not authenticated
 */
export async function authenticateAdminPage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const basePath = process.env.BASE_PATH || '';

    // Get token from cookie or query param
    const token = req.cookies?.adminToken || req.query.token as string;

    // Legacy simple token auth (for backwards compatibility during transition)
    if (token === config.superAdminToken) {
      req.user = {
        userId: 'system',
        email: 'admin@system',
        name: 'System Admin',
        role: 'SUPER_ADMIN',
        groupId: null,
        birthDate: null,
      };
      req.superAdmin = req.user;
      next();
      return;
    }

    if (!token) {
      // Redirect to admin login
      res.redirect(`${basePath}/admin/login`);
      return;
    }

    // Verify JWT token
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (!payload.userId) {
      res.redirect(`${basePath}/admin/login?error=invalid_token`);
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        groupId: true,
        birthDate: true,
        group: {
          select: {
            id: true,
            name: true,
            isActive: true,
          }
        }
      }
    });

    if (!user || !user.isActive) {
      res.redirect(`${basePath}/admin/login?error=account_disabled`);
      return;
    }

    // For non-SUPER_ADMIN, check group is active
    if (user.role !== 'SUPER_ADMIN' && user.group && !user.group.isActive) {
      res.redirect(`${basePath}/admin/login?error=group_disabled`);
      return;
    }

    // Set user on request
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      groupId: user.groupId,
      birthDate: user.birthDate?.toISOString() || null,
    };
    req.groupId = user.groupId;

    if (user.role === 'SUPER_ADMIN') {
      req.superAdmin = req.user;
    }

    next();
  } catch (error) {
    const basePath = process.env.BASE_PATH || '';
    if (error instanceof jwt.TokenExpiredError) {
      res.redirect(`${basePath}/admin/login?error=token_expired`);
      return;
    }
    res.redirect(`${basePath}/admin/login?error=invalid_token`);
  }
}

/**
 * Middleware to authenticate super admin only
 */
export async function authenticateSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await authenticateUser(req, res, () => {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, error: 'Super admin access required' });
      return;
    }
    next();
  });
}

/**
 * Middleware to authenticate either user or super admin (any authenticated user)
 */
export async function authenticateAny(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await authenticateUser(req, res, next);
}

/**
 * Generate JWT token for user
 */
export function generateUserToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string,
  } as jwt.SignOptions);
}

/**
 * Generate JWT token for super admin (same as user, just different name for clarity)
 */
export function generateSuperAdminToken(payload: JwtPayload): string {
  return generateUserToken(payload);
}

/**
 * Optional auth - doesn't fail if not authenticated
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.token || req.query.token as string;

    if (!token) {
      next();
      return;
    }

    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        groupId: true,
        birthDate: true,
      }
    });

    if (user && user.isActive) {
      req.user = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        groupId: user.groupId,
        birthDate: user.birthDate?.toISOString() || null,
      };
      req.groupId = user.groupId;
    }

    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
}
