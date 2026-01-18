import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Middleware to ensure tenant isolation
 * Injects companyId into the request for use in services
 */
export function tenantIsolation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Super admins can access any group via query param
  if (req.superAdmin) {
    const groupId = req.query.groupId as string;
    if (groupId) {
      req.groupId = groupId;
    }
    next();
    return;
  }

  // Regular users must have a groupId from their JWT
  if (!req.user?.groupId) {
    res.status(403).json({
      success: false,
      error: 'Group context required'
    });
    return;
  }

  req.groupId = req.user.groupId;
  next();
}

/**
 * Helper to get groupId from request
 * Throws if not available
 */
export function getGroupId(req: AuthenticatedRequest): string {
  const groupId = req.groupId || req.user?.groupId;
  if (!groupId) {
    throw new Error('Group context not available');
  }
  return groupId;
}

/**
 * Helper to check if request has super admin access
 */
export function isSuperAdmin(req: AuthenticatedRequest): boolean {
  return !!req.superAdmin;
}

/**
 * Helper to check if user can access a specific group
 */
export function canAccessGroup(req: AuthenticatedRequest, groupId: string): boolean {
  // Super admin can access any group
  if (req.superAdmin) return true;

  // Regular users can only access their own group
  return req.user?.groupId === groupId;
}
