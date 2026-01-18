import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, Role, isAdult } from '../types/index.js';

/**
 * Permission definitions based on access matrix
 *
 * SUPER_ADMIN: Platform owner - full system access
 * GROUP_ADMIN: Family account owner (subscriber who pays)
 * PARTNER: Spouse with full family access
 * MEMBER: Kids/relatives - limited access (billing only if 18+)
 */

// Pages that all authenticated users can access (within their group)
const FAMILY_PAGES = [
  'dashboard',
  'analytics',
  'important-dates',
  'wishlist',
  'chores',
  'gift-orders',
  'seasonal-reminders',
];

// Pages only GROUP_ADMIN can manage users
const GROUP_ADMIN_PAGES = [
  'users',
];

// Pages only SUPER_ADMIN can access
const SUPER_ADMIN_ONLY_PAGES = [
  'ads',
  'groups',
  'ai-config',
  'ai-agents',
  'ai-tools',
  'functions',
  'logic-rules',
  'voices',
  'greeting',
  'webhooks',
  'sms-settings',
  'settings',
  'features',
  'payment-processing',
];

// Billing - accessible to all but MEMBER must be 18+
const BILLING_PAGES = [
  'billing',
  'payments',
];

/**
 * Permission definitions for API operations
 */
const permissions: Record<string, Role[]> = {
  // Group management (super admin only)
  'group:create': ['SUPER_ADMIN'],
  'group:read_all': ['SUPER_ADMIN'],
  'group:update': ['SUPER_ADMIN'],
  'group:delete': ['SUPER_ADMIN'],

  // User management (group admin + super admin)
  'user:create': ['SUPER_ADMIN', 'GROUP_ADMIN'],
  'user:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'user:update': ['SUPER_ADMIN', 'GROUP_ADMIN'],
  'user:delete': ['SUPER_ADMIN', 'GROUP_ADMIN'],

  // Important dates (all family members)
  'date:create': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'date:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'date:update': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'date:delete': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],

  // Wishlist (all family members)
  'wishlist:create': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'wishlist:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'wishlist:update': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'wishlist:delete': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],

  // Chores (all family members)
  'chore:create': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'chore:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'chore:update': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'chore:delete': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],

  // Gift orders (all family members)
  'order:create': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'order:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'order:update': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'order:delete': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],

  // Seasonal reminders (all family members)
  'reminder:create': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'reminder:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'reminder:update': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],

  // Ads management (super admin only)
  'ads:create': ['SUPER_ADMIN'],
  'ads:read': ['SUPER_ADMIN'],
  'ads:update': ['SUPER_ADMIN'],
  'ads:delete': ['SUPER_ADMIN'],

  // AI Configuration (super admin only)
  'ai:config': ['SUPER_ADMIN'],
  'ai:agents': ['SUPER_ADMIN'],
  'ai:tools': ['SUPER_ADMIN'],
  'ai:functions': ['SUPER_ADMIN'],
  'ai:logic': ['SUPER_ADMIN'],

  // System settings (super admin only)
  'system:settings': ['SUPER_ADMIN'],
  'system:features': ['SUPER_ADMIN'],
  'system:webhooks': ['SUPER_ADMIN'],
  'system:sms': ['SUPER_ADMIN'],
  'system:calls': ['SUPER_ADMIN'],
  'system:dtmf': ['SUPER_ADMIN'],

  // Billing (all, but MEMBER needs age check done separately)
  'billing:read': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
  'billing:create': ['SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER'],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: string): boolean {
  const allowedRoles = permissions[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

/**
 * Check if user can access a page based on role and age
 */
export function canAccessPage(
  page: string,
  role: Role,
  birthDate?: string | null
): boolean {
  // SUPER_ADMIN can access everything
  if (role === 'SUPER_ADMIN') return true;

  // Check family pages (all roles)
  if (FAMILY_PAGES.includes(page)) return true;

  // Check GROUP_ADMIN pages
  if (GROUP_ADMIN_PAGES.includes(page)) {
    return role === 'GROUP_ADMIN';
  }

  // Check billing pages (age restriction for MEMBER)
  if (BILLING_PAGES.includes(page)) {
    if (role === 'MEMBER') {
      return isAdult(birthDate);
    }
    return true; // GROUP_ADMIN and PARTNER always have access
  }

  // SUPER_ADMIN only pages
  if (SUPER_ADMIN_ONLY_PAGES.includes(page)) {
    return false;
  }

  return false;
}

/**
 * Middleware factory to require specific permission
 */
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Check permission
    if (!hasPermission(user.role, permission)) {
      res.status(403).json({
        success: false,
        error: `Permission denied: ${permission}`
      });
      return;
    }

    // Special check for billing permissions for MEMBER role
    if (permission.startsWith('billing:') && user.role === 'MEMBER') {
      if (!isAdult(user.birthDate)) {
        res.status(403).json({
          success: false,
          error: 'Billing access requires age 18+'
        });
        return;
      }
    }

    next();
  };
}

/**
 * Middleware factory to require one of multiple roles
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied: requires one of: ${roles.join(', ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require super admin role
 */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');

/**
 * Middleware to require group admin role
 */
export const requireGroupAdmin = requireRole('SUPER_ADMIN', 'GROUP_ADMIN');

/**
 * Middleware to require partner or above (not MEMBER)
 */
export const requirePartnerOrAbove = requireRole('SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER');

/**
 * Middleware to require any authenticated family member
 */
export const requireFamilyMember = requireRole('SUPER_ADMIN', 'GROUP_ADMIN', 'PARTNER', 'MEMBER');

/**
 * Middleware for admin page access (checks role and age for billing)
 */
export function requirePageAccess(page: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!canAccessPage(page, user.role, user.birthDate)) {
      res.status(403).json({
        success: false,
        error: 'Access denied to this page'
      });
      return;
    }

    next();
  };
}

/**
 * Get list of accessible pages for a user
 */
export function getAccessiblePages(role: Role, birthDate?: string | null): string[] {
  const pages: string[] = [];

  // Family pages for all
  pages.push(...FAMILY_PAGES);

  // GROUP_ADMIN pages
  if (role === 'SUPER_ADMIN' || role === 'GROUP_ADMIN') {
    pages.push(...GROUP_ADMIN_PAGES);
  }

  // Billing pages (age check for MEMBER)
  if (role !== 'MEMBER' || isAdult(birthDate)) {
    pages.push(...BILLING_PAGES);
  }

  // SUPER_ADMIN only pages
  if (role === 'SUPER_ADMIN') {
    pages.push(...SUPER_ADMIN_ONLY_PAGES);
  }

  return pages;
}
