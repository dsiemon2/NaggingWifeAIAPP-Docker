import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import * as userService from '../services/userService.js';
import { generateUserToken, generateSuperAdminToken, authenticateUser } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  identifier: z.string().min(1), // email OR username
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  name: z.string().min(2),
  groupDomain: z.string().min(1), // Group domain to register under
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/register
 * Public registration for new users
 */
router.post('/register', async (req, res: Response) => {
  try {
    const { email, username, password, name, groupDomain } = registerSchema.parse(req.body);

    // Find group by domain
    const group = await prisma.group.findUnique({
      where: { domain: groupDomain.toLowerCase() },
    });

    if (!group) {
      res.status(400).json({ success: false, error: 'Group not found' });
      return;
    }

    if (!group.isActive) {
      res.status(400).json({ success: false, error: 'Group registration is disabled' });
      return;
    }

    // Check if email is already registered
    const emailExists = await userService.isEmailRegistered(email, group.id);
    if (emailExists) {
      res.status(400).json({ success: false, error: 'Email already registered' });
      return;
    }

    // Check if username is taken (if provided)
    if (username) {
      const usernameTaken = await userService.isUsernameTaken(username, group.id);
      if (usernameTaken) {
        res.status(400).json({ success: false, error: 'Username already taken' });
        return;
      }
    }

    // Register user
    const { user, emailVerificationToken } = await userService.registerUser({
      email,
      username,
      password,
      name,
      groupId: group.id,
    });

    // TODO: Send verification email with token
    // In production, this would send an actual email
    logger.info({ email, token: emailVerificationToken }, 'Verification token generated');

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      data: {
        user,
        // Include token in dev mode only
        ...(process.env.NODE_ENV !== 'production' && { verificationToken: emailVerificationToken }),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Registration error:');
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login for company users (admin/manager) - supports email OR username
 */
router.post('/login', async (req, res: Response) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);

    // Find user by email OR username
    const user = await userService.findUserByEmailOrUsername(identifier);

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Validate password
    const isValid = await userService.validatePassword(user, password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check if user and group are active
    if (!user.isActive) {
      res.status(401).json({ success: false, error: 'Account is disabled' });
      return;
    }

    if (user.group && !user.group.isActive) {
      res.status(401).json({ success: false, error: 'Group account is disabled' });
      return;
    }

    // Generate token
    const token = generateUserToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      groupId: user.groupId,
      role: user.role as 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'PARTNER' | 'MEMBER',
      birthDate: user.birthDate?.toISOString() || null,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        group: user.group ? {
          id: user.group.id,
          name: user.group.name,
        } : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Login error:');
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * POST /api/auth/super-admin/login
 * Login for super admin
 */
router.post('/super-admin/login', async (req, res: Response) => {
  try {
    const { email, password } = superAdminLoginSchema.parse(req.body);

    const superAdmin = await userService.getSuperAdminByEmail(email);

    if (!superAdmin) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const isValid = await userService.validatePassword(superAdmin, password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateSuperAdminToken({
      userId: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: 'SUPER_ADMIN',
      groupId: null,
      birthDate: null,
    });

    res.json({
      success: true,
      data: {
        token,
        superAdmin: {
          id: superAdmin.id,
          email: superAdmin.email,
          name: superAdmin.name,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Super admin login error:');
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const user = await userService.getUserById(req.user.userId, req.user.groupId);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
        groupId: req.user.groupId,
      },
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Get me error:');
    res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address using token
 */
router.post('/verify-email', async (req, res: Response) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);

    const user = await userService.verifyEmail(token);

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: { user },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Email verification error:');
    res.status(500).json({ success: false, error: 'Email verification failed' });
  }
});

/**
 * GET /api/auth/verify-email/:token
 * Verify email via GET (for clickable links in emails)
 */
router.get('/verify-email/:token', async (req, res: Response) => {
  try {
    const token = req.params.token;

    const user = await userService.verifyEmail(token);

    if (!user) {
      // Redirect to frontend with error
      res.redirect('/auth/verify-email?status=error&message=Invalid+or+expired+token');
      return;
    }

    // Redirect to frontend with success
    res.redirect('/auth/verify-email?status=success');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Email verification error:');
    res.redirect('/auth/verify-email?status=error&message=Verification+failed');
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req, res: Response) => {
  try {
    const { email } = requestResetSchema.parse(req.body);

    const result = await userService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    if (result) {
      // TODO: Send password reset email with token
      // In production, this would send an actual email
      logger.info({ email, token: result.passwordResetToken }, 'Password reset token generated');
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Include token in dev mode only
      ...(process.env.NODE_ENV !== 'production' && result && { resetToken: result.passwordResetToken }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Forgot password error:');
    res.status(500).json({ success: false, error: 'Password reset request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await userService.resetPassword(token, password);

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
      data: { user },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Reset password error:');
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

/**
 * GET /api/auth/check-username/:username
 * Check if username is available (for real-time validation)
 */
router.get('/check-username/:username', async (req, res: Response) => {
  try {
    const { username } = req.params;
    const { groupDomain } = req.query;

    if (!groupDomain || typeof groupDomain !== 'string') {
      res.status(400).json({ success: false, error: 'groupDomain query param required' });
      return;
    }

    // Find group
    const group = await prisma.group.findUnique({
      where: { domain: groupDomain.toLowerCase() },
    });

    if (!group) {
      res.status(400).json({ success: false, error: 'Group not found' });
      return;
    }

    const isTaken = await userService.isUsernameTaken(username, group.id);

    res.json({
      success: true,
      data: {
        username,
        available: !isTaken,
      },
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Check username error:');
    res.status(500).json({ success: false, error: 'Failed to check username' });
  }
});

/**
 * GET /api/auth/check-email/:email
 * Check if email is available (for real-time validation)
 */
router.get('/check-email/:email', async (req, res: Response) => {
  try {
    const { email } = req.params;
    const { groupDomain } = req.query;

    if (!groupDomain || typeof groupDomain !== 'string') {
      res.status(400).json({ success: false, error: 'groupDomain query param required' });
      return;
    }

    // Find group
    const group = await prisma.group.findUnique({
      where: { domain: groupDomain.toLowerCase() },
    });

    if (!group) {
      res.status(400).json({ success: false, error: 'Group not found' });
      return;
    }

    const isRegistered = await userService.isEmailRegistered(email, group.id);

    res.json({
      success: true,
      data: {
        email,
        available: !isRegistered,
      },
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Check email error:');
    res.status(500).json({ success: false, error: 'Failed to check email' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, server just acknowledges)
 */
router.post('/logout', (_req, res: Response) => {
  res.json({ success: true, message: 'Logged out' });
});

// ==================== ACCOUNT MANAGEMENT ENDPOINTS ====================

// Account validation schemas
const updateNameSchema = z.object({
  name: z.string().min(2).max(100),
});

const updateEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updatePhoneSchema = z.object({
  phone: z.string().min(10).max(20).optional().nullable(),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

const addPaymentMethodSchema = z.object({
  cardType: z.string().min(1),
  cardLast4: z.string().length(4),
  cardHolderName: z.string().min(1),
  expiryMonth: z.number().min(1).max(12),
  expiryYear: z.number().min(2024).max(2099),
  isDefault: z.boolean().optional(),
  gateway: z.string().optional(),
  gatewayCustomerId: z.string().optional(),
  gatewayPaymentMethodId: z.string().optional(),
});

const updateNotificationsSchema = z.object({
  importantDatesEmail: z.boolean().optional(),
  importantDatesSms: z.boolean().optional(),
  importantDatesPush: z.boolean().optional(),
  choresEmail: z.boolean().optional(),
  choresSms: z.boolean().optional(),
  choresPush: z.boolean().optional(),
  wishlistEmail: z.boolean().optional(),
  wishlistSms: z.boolean().optional(),
  wishlistPush: z.boolean().optional(),
  giftOrdersEmail: z.boolean().optional(),
  giftOrdersSms: z.boolean().optional(),
  giftOrdersPush: z.boolean().optional(),
  paymentEmail: z.boolean().optional(),
  paymentSms: z.boolean().optional(),
  paymentPush: z.boolean().optional(),
  securityEmail: z.boolean().optional(),
  securitySms: z.boolean().optional(),
  securityPush: z.boolean().optional(),
});

/**
 * PUT /api/auth/account/name
 * Update user's name
 */
router.put('/account/name', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { name } = updateNameSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name },
      select: { id: true, name: true, email: true },
    });

    res.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Update name error:');
    res.status(500).json({ success: false, error: 'Failed to update name' });
  }
});

/**
 * PUT /api/auth/account/email
 * Update user's email (requires password confirmation)
 */
router.put('/account/email', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { email, password } = updateEmailSchema.parse(req.body);

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid password' });
      return;
    }

    // Check if email is already in use
    const emailExists = await prisma.user.findFirst({
      where: { email, id: { not: req.user.userId } },
    });
    if (emailExists) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { email },
      select: { id: true, name: true, email: true },
    });

    res.json({ success: true, data: { user: updatedUser } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Update email error:');
    res.status(500).json({ success: false, error: 'Failed to update email' });
  }
});

/**
 * PUT /api/auth/account/phone
 * Update user's phone number
 */
router.put('/account/phone', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { phone } = updatePhoneSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { phone: phone || null },
      select: { id: true, name: true, email: true, phone: true },
    });

    res.json({ success: true, data: { user } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Update phone error:');
    res.status(500).json({ success: false, error: 'Failed to update phone' });
  }
});

/**
 * PUT /api/auth/account/password
 * Change user's password
 */
router.put('/account/password', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Update password error:');
    res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

/**
 * GET /api/auth/account/payment-methods
 * Get user's saved payment methods
 */
router.get('/account/payment-methods', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const paymentMethods = await prisma.userPaymentMethod.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: { paymentMethods } });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Get payment methods error:');
    res.status(500).json({ success: false, error: 'Failed to get payment methods' });
  }
});

/**
 * POST /api/auth/account/payment-methods
 * Add a new payment method
 */
router.post('/account/payment-methods', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const data = addPaymentMethodSchema.parse(req.body);

    // If this is the first payment method or marked as default, update others
    if (data.isDefault) {
      await prisma.userPaymentMethod.updateMany({
        where: { userId: req.user.userId },
        data: { isDefault: false },
      });
    }

    // Check if this is the first payment method
    const existingCount = await prisma.userPaymentMethod.count({
      where: { userId: req.user.userId },
    });

    const paymentMethod = await prisma.userPaymentMethod.create({
      data: {
        userId: req.user.userId,
        cardType: data.cardType,
        cardLast4: data.cardLast4,
        cardHolderName: data.cardHolderName,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
        isDefault: data.isDefault || existingCount === 0,
        gateway: data.gateway,
        gatewayCustomerId: data.gatewayCustomerId,
        gatewayPaymentMethodId: data.gatewayPaymentMethodId,
      },
    });

    res.status(201).json({ success: true, data: { paymentMethod } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Add payment method error:');
    res.status(500).json({ success: false, error: 'Failed to add payment method' });
  }
});

/**
 * PUT /api/auth/account/payment-methods/:id/default
 * Set a payment method as default
 */
router.put('/account/payment-methods/:id/default', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Verify ownership
    const paymentMethod = await prisma.userPaymentMethod.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!paymentMethod) {
      res.status(404).json({ success: false, error: 'Payment method not found' });
      return;
    }

    // Remove default from all others
    await prisma.userPaymentMethod.updateMany({
      where: { userId: req.user.userId },
      data: { isDefault: false },
    });

    // Set this one as default
    const updated = await prisma.userPaymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });

    res.json({ success: true, data: { paymentMethod: updated } });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Set default payment method error:');
    res.status(500).json({ success: false, error: 'Failed to set default payment method' });
  }
});

/**
 * DELETE /api/auth/account/payment-methods/:id
 * Remove a payment method
 */
router.delete('/account/payment-methods/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Verify ownership
    const paymentMethod = await prisma.userPaymentMethod.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!paymentMethod) {
      res.status(404).json({ success: false, error: 'Payment method not found' });
      return;
    }

    await prisma.userPaymentMethod.delete({ where: { id } });

    // If this was the default, make the most recent one default
    if (paymentMethod.isDefault) {
      const newest = await prisma.userPaymentMethod.findFirst({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
      });
      if (newest) {
        await prisma.userPaymentMethod.update({
          where: { id: newest.id },
          data: { isDefault: true },
        });
      }
    }

    res.json({ success: true, message: 'Payment method removed' });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Delete payment method error:');
    res.status(500).json({ success: false, error: 'Failed to remove payment method' });
  }
});

/**
 * PUT /api/auth/account/notifications
 * Update notification preferences
 */
router.put('/account/notifications', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const data = updateNotificationsSchema.parse(req.body);

    const prefs = await prisma.userNotificationPreference.upsert({
      where: { userId: req.user.userId },
      create: {
        userId: req.user.userId,
        ...data,
      },
      update: data,
    });

    res.json({ success: true, data: { preferences: prefs } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Update notifications error:');
    res.status(500).json({ success: false, error: 'Failed to update notification preferences' });
  }
});

/**
 * DELETE /api/auth/account/devices/:id
 * Remove a specific device/session
 */
router.delete('/account/devices/:id', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Verify ownership
    const device = await prisma.userDevice.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!device) {
      res.status(404).json({ success: false, error: 'Device not found' });
      return;
    }

    await prisma.userDevice.delete({ where: { id } });

    res.json({ success: true, message: 'Device removed' });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Delete device error:');
    res.status(500).json({ success: false, error: 'Failed to remove device' });
  }
});

/**
 * DELETE /api/auth/account/devices
 * Sign out of all devices except current
 */
router.delete('/account/devices', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Get current device IP from request
    const currentIp = req.ip || req.socket.remoteAddress;

    // Delete all devices except current
    await prisma.userDevice.deleteMany({
      where: {
        userId: req.user.userId,
        NOT: { ipAddress: currentIp },
      },
    });

    res.json({ success: true, message: 'Signed out of all other devices' });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Delete all devices error:');
    res.status(500).json({ success: false, error: 'Failed to sign out of devices' });
  }
});

export default router;
