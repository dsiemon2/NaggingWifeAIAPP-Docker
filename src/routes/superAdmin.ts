import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { authenticateSuperAdmin } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import bcrypt from 'bcrypt';

const router = Router();

// Apply super admin auth to all routes
router.use(authenticateSuperAdmin);

// Validation schemas
const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().min(1).max(255),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminName: z.string().min(1).max(255),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/super-admin/groups
 * List all groups
 */
router.get('/groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true } },
        },
      }),
      prisma.group.count(),
    ]);

    res.json({
      success: true,
      data: {
        groups,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ success: false, error: 'Failed to list groups' });
  }
});

/**
 * POST /api/super-admin/groups
 * Create a new group with admin user
 */
router.post('/groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const input = createGroupSchema.parse(req.body);

    // Check if domain already exists
    const existing = await prisma.group.findUnique({
      where: { domain: input.domain },
    });
    if (existing) {
      res.status(400).json({ success: false, error: 'Domain already registered' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.adminPassword, 10);

    // Create group with admin user
    const group = await prisma.group.create({
      data: {
        name: input.name,
        domain: input.domain,
        users: {
          create: {
            name: input.adminName,
            email: input.adminEmail,
            password: hashedPassword,
            role: 'GROUP_ADMIN',
          },
        },
      },
      include: {
        users: true,
        _count: { select: { users: true } },
      },
    });

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Create group error:', error);
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
});

/**
 * GET /api/super-admin/groups/:id
 * Get group details
 */
router.get('/groups/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        users: true,
        _count: { select: { users: true } },
      },
    });

    if (!group) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    res.json({ success: true, data: group });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ success: false, error: 'Failed to get group' });
  }
});

/**
 * PUT /api/super-admin/groups/:id
 * Update group
 */
router.put('/groups/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const input = updateGroupSchema.parse(req.body);

    // Check domain uniqueness if changing
    if (input.domain) {
      const existing = await prisma.group.findUnique({
        where: { domain: input.domain },
      });
      if (existing && existing.id !== id) {
        res.status(400).json({ success: false, error: 'Domain already in use' });
        return;
      }
    }

    const group = await prisma.group.update({
      where: { id },
      data: input,
    });

    res.json({ success: true, data: group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Update group error:', error);
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
});

/**
 * DELETE /api/super-admin/groups/:id
 * Delete group
 */
router.delete('/groups/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.group.delete({ where: { id } });

    res.json({ success: true, message: 'Group deleted' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});

export default router;
