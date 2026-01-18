import { Router, Response } from 'express';
import { z } from 'zod';
import * as userService from '../services/userService.js';
import { authenticateUser } from '../middleware/auth.js';
import { requireGroupAdmin } from '../middleware/rbac.js';
import { tenantIsolation, getGroupId } from '../middleware/tenant.js';
import { AuthenticatedRequest, Role } from '../types/index.js';

const router = Router();

// Apply auth and tenant isolation to all routes
router.use(authenticateUser);
router.use(tenantIsolation);

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  role: z.enum(['GROUP_ADMIN', 'PARTNER', 'MEMBER']),
  birthDate: z.string().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['GROUP_ADMIN', 'PARTNER', 'MEMBER']).optional(),
  isActive: z.boolean().optional(),
  birthDate: z.string().optional(),
});

/**
 * GET /api/users
 * List users in company
 */
router.get('/', requireGroupAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = getGroupId(req);
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const result = await userService.listUsers(groupId, { page, pageSize });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', requireGroupAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = getGroupId(req);
    const input = createUserSchema.parse(req.body);

    // Check if email already exists (email is now globally unique)
    const existing = await userService.isEmailRegistered(input.email);
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already registered' });
      return;
    }

    const user = await userService.createUser({
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role as Role,
      groupId,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * GET /api/users/:id
 * Get user details
 */
router.get('/:id', requireGroupAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = getGroupId(req);
    const { id } = req.params;

    const user = await userService.getUserById(id, groupId);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', requireGroupAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = getGroupId(req);
    const { id } = req.params;
    const input = updateUserSchema.parse(req.body);

    // Prevent deactivating yourself
    if (input.isActive === false && id === req.user?.userId) {
      res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
      return;
    }

    // Prevent demoting yourself
    if (input.role === 'MEMBER' && id === req.user?.userId) {
      res.status(400).json({ success: false, error: 'Cannot demote your own account' });
      return;
    }

    const user = await userService.updateUser(id, groupId, {
      ...input,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    });

    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', requireGroupAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = getGroupId(req);
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user?.userId) {
      res.status(400).json({ success: false, error: 'Cannot delete your own account' });
      return;
    }

    await userService.deleteUser(id, groupId);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
