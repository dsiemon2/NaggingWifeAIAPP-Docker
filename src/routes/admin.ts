import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import pino from 'pino';
import multer from 'multer';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/index.js';
import { generateUserToken } from '../middleware/auth.js';
import { canAccessPage, getAccessiblePages } from '../middleware/rbac.js';
import { Role, JwtPayload, isAdult } from '../types/index.js';
import * as userService from '../services/userService.js';

const router = Router();
const logger = pino();

// Base path for URL prefixes (Docker deployment)
const basePath = process.env.BASE_PATH || '/NaggingWife';

// Extended request type with user info
interface AdminRequest extends Request {
  adminUser?: JwtPayload;
}

// Helper to get branding data
async function getBranding() {
  let branding = await prisma.branding.findFirst();
  if (!branding) {
    branding = {
      id: 'default',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#9333ea',
      secondaryColor: '#7e22ce',
      accentColor: '#a855f7',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      updatedAt: new Date(),
    };
  }
  return branding;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.docx', '.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, Excel, and Word files are allowed'));
    }
  },
});

// ============================================
// LOGIN/LOGOUT ROUTES (No Auth Required)
// ============================================

// Admin Login Page
router.get('/login', async (req: Request, res: Response) => {
  const branding = await getBranding();
  res.render('admin/login', {
    basePath,
    branding,
    error: req.query.error,
    success: req.query.success,
  });
});

// Admin Login POST
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, remember } = req.body;

    // Find user by email
    const user = await userService.findUserByEmailOrUsername(email);

    if (!user) {
      return res.redirect(`${basePath}/admin/login?error=invalid_credentials`);
    }

    // Validate password
    const isValid = await userService.validatePassword(user, password);
    if (!isValid) {
      return res.redirect(`${basePath}/admin/login?error=invalid_credentials`);
    }

    // Check if user and group are active
    if (!user.isActive) {
      return res.redirect(`${basePath}/admin/login?error=account_disabled`);
    }

    if (user.role !== 'SUPER_ADMIN' && user.group && !user.group.isActive) {
      return res.redirect(`${basePath}/admin/login?error=group_disabled`);
    }

    // Generate JWT token
    const token = generateUserToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      groupId: user.groupId,
      birthDate: user.birthDate?.toISOString() || null,
    });

    // Update last login
    await userService.updateLastLogin(user.id, req.ip || undefined);

    // Set cookie and redirect to dashboard
    const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 24 hours
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge,
      sameSite: 'lax',
    });

    res.redirect(`${basePath}/admin?token=${token}`);
  } catch (err) {
    logger.error({ err }, 'Admin login error');
    res.redirect(`${basePath}/admin/login?error=login_failed`);
  }
});

// Admin Logout
router.get('/logout', (req: Request, res: Response) => {
  res.clearCookie('adminToken');
  res.redirect(`${basePath}/admin/login?success=logged_out`);
});

// ============================================
// AUTH MIDDLEWARE
// ============================================

// Auth middleware - supports JWT token (query, cookie, or header)
async function requireAuth(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    // Get token from various sources
    const token = req.query.token as string || req.cookies?.adminToken;
    const validSimpleToken = process.env.ADMIN_TOKEN || 'admin';

    // Legacy simple token auth (for backwards compatibility)
    if (token === validSimpleToken) {
      req.adminUser = {
        userId: 'system',
        email: 'admin@system',
        name: 'System Admin',
        role: 'SUPER_ADMIN',
        groupId: null,
        birthDate: null,
      };
      res.locals.token = token;
      res.locals.user = req.adminUser;
      res.locals._basePath = basePath;
      next();
      return;
    }

    if (!token) {
      return res.redirect(`${basePath}/admin/login`);
    }

    // Verify JWT token
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (!payload.userId) {
      return res.redirect(`${basePath}/admin/login?error=invalid_token`);
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
      return res.redirect(`${basePath}/admin/login?error=account_disabled`);
    }

    if (user.role !== 'SUPER_ADMIN' && user.group && !user.group.isActive) {
      return res.redirect(`${basePath}/admin/login?error=group_disabled`);
    }

    // Set user on request and locals
    req.adminUser = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      groupId: user.groupId,
      birthDate: user.birthDate?.toISOString() || null,
    };

    res.locals.token = token;
    res.locals.user = req.adminUser;
    res.locals._basePath = basePath;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.redirect(`${basePath}/admin/login?error=token_expired`);
    }
    return res.redirect(`${basePath}/admin/login?error=invalid_token`);
  }
}

// Page access middleware factory
function requirePageAccess(page: string) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = req.adminUser;
    if (!user) {
      return res.redirect(`${basePath}/admin/login`);
    }

    if (!canAccessPage(page, user.role, user.birthDate)) {
      return res.status(403).render('admin/error', {
        error: 'Access denied. You do not have permission to view this page.',
        token: res.locals.token,
        user: res.locals.user,
        _basePath: basePath,
      });
    }

    next();
  };
}

// Apply auth middleware to all routes below
router.use(requireAuth);

// Dashboard redirect - support both /admin and /admin/dashboard
router.get('/dashboard', (req, res) => {
  res.redirect(`${basePath}/admin?token=${res.locals.token}`);
});

// Dashboard - Nagging Wife AI
router.get('/', async (req, res) => {
  try {
    const branding = await getBranding();
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Get stats for the new Nagging Wife AI dashboard
    const [pendingChores, wishlistItems, giftOrders, allDates, announcements, pendingChoresList, wishlistItemsList, adsList] = await Promise.all([
      prisma.chore.count({ where: { status: 'pending', isActive: true } }),
      prisma.wishlistItem.count({ where: { isPurchased: false, isActive: true } }),
      prisma.giftOrder.count(),
      prisma.importantDate.findMany({ where: { isActive: true }, orderBy: { date: 'asc' } }),
      prisma.ad.findMany({ where: { placement: 'announcement-bar', isActive: true }, take: 3 }),
      prisma.chore.findMany({ where: { status: 'pending', isActive: true }, orderBy: { priority: 'desc' }, take: 10 }),
      prisma.wishlistItem.findMany({ where: { isPurchased: false, isActive: true }, orderBy: { priority: 'desc' }, take: 10 }),
      prisma.ad.findMany({ where: { isActive: true, placement: { not: 'announcement-bar' } }, take: 4 }),
    ]);

    // Calculate upcoming dates with days until
    const upcomingDates = allDates.map(date => {
      const eventDate = new Date(date.date);
      const thisYearDate = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      if (thisYearDate < today) thisYearDate.setFullYear(thisYearDate.getFullYear() + 1);
      const daysUntil = Math.ceil((thisYearDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...date, daysUntil };
    }).sort((a, b) => a.daysUntil - b.daysUntil);

    const upcomingCount = upcomingDates.filter(d => d.daysUntil <= 7).length;

    res.render('admin/dashboard', {
      token: res.locals.token,
      branding,
      basePath,
      stats: {
        upcomingDates: upcomingCount,
        pendingChores,
        wishlistItems,
        giftOrders,
      },
      upcomingDates,
      pendingChores: pendingChoresList,
      wishlistItems: wishlistItemsList,
      announcements,
      ads: adsList,
    });
  } catch (err) {
    logger.error({ err }, 'Dashboard error');
    res.render('admin/error', { error: 'Failed to load dashboard', token: res.locals.token });
  }
});

// Analytics Dashboard
router.get('/analytics', async (req, res) => {
  try {
    // Get date range from query params
    const daysParam = parseInt(req.query.days as string) || 30;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysParam);

    // Session stats
    const [totalSessions, completedSessions, scheduledSessions, cancelledSessions] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({ where: { status: 'completed' } }),
      prisma.session.count({ where: { status: 'scheduled' } }),
      prisma.session.count({ where: { status: 'cancelled' } }),
    ]);

    // By topic
    const byTopic = await prisma.session.groupBy({
      by: ['topic'],
      _count: true,
    });

    // Average score from sessions
    const avgScore = await prisma.session.aggregate({
      where: { score: { not: null } },
      _avg: { score: true },
    });

    // Recent completed sessions
    const recentCompleted = await prisma.session.findMany({
      where: { status: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    // Top performers (score >= 7)
    const topPerformers = await prisma.session.findMany({
      where: {
        status: 'completed',
        score: { gte: 7 },
      },
      orderBy: { score: 'desc' },
      take: 10,
    });

    // By status for pie chart
    const byStatus = await prisma.session.groupBy({
      by: ['status'],
      _count: true,
    });

    // Chores stats
    const [totalChores, completedChores, pendingChores, overdueChores] = await Promise.all([
      prisma.chore.count(),
      prisma.chore.count({ where: { status: 'completed' } }),
      prisma.chore.count({ where: { status: 'pending' } }),
      prisma.chore.count({ where: { status: 'pending', dueDate: { lt: new Date() } } }),
    ]);

    // Gift orders stats
    const [totalGiftOrders, deliveredOrders, pendingOrders] = await Promise.all([
      prisma.giftOrder.count(),
      prisma.giftOrder.count({ where: { status: 'delivered' } }),
      prisma.giftOrder.count({ where: { status: 'pending' } }),
    ]);

    // Wishlist stats
    const [totalWishlistItems, purchasedItems] = await Promise.all([
      prisma.wishlistItem.count(),
      prisma.wishlistItem.count({ where: { isPurchased: true } }),
    ]);

    // Important dates coming up
    const upcomingDates = await prisma.importantDate.findMany({
      where: {
        isActive: true,
        date: { gte: new Date() },
      },
      orderBy: { date: 'asc' },
      take: 5,
    });

    res.render('admin/analytics', {
      token: res.locals.token,
      days: daysParam,
      stats: {
        totalSessions,
        completedSessions,
        scheduledSessions,
        cancelledSessions,
        completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        averageScore: avgScore._avg.score ? avgScore._avg.score.toFixed(1) : 'N/A',
      },
      choreStats: {
        total: totalChores,
        completed: completedChores,
        pending: pendingChores,
        overdue: overdueChores,
      },
      giftStats: {
        total: totalGiftOrders,
        delivered: deliveredOrders,
        pending: pendingOrders,
      },
      wishlistStats: {
        total: totalWishlistItems,
        purchased: purchasedItems,
      },
      byTopic: byTopic.map((t) => ({
        name: t.topic,
        count: t._count,
      })),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      recentCompleted: recentCompleted.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        topic: s.topic,
        score: s.score,
        notes: s.notes,
        completedAt: s.updatedAt,
      })),
      topPerformers: topPerformers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        topic: s.topic,
        score: s.score,
        notes: s.notes,
        completedAt: s.updatedAt,
      })),
      upcomingDates,
    });
  } catch (err) {
    logger.error({ err }, 'Analytics error');
    res.render('admin/error', { error: 'Failed to load analytics', token: res.locals.token });
  }
});

// Groups (Family Groups)
router.get('/groups', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    res.render('admin/groups', {
      token: res.locals.token,
      groups,
      total: groups.length,
    });
  } catch (err) {
    logger.error({ err }, 'Groups error');
    res.render('admin/error', { error: 'Failed to load groups', token: res.locals.token });
  }
});


// Group CRUD
router.post('/groups', async (req, res) => {
  try {
    const { name, domain } = req.body;
    await prisma.group.create({
      data: { name, domain },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create group error');
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
});

router.get('/groups/:id/edit', async (req, res) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
    res.json({ success: true, group });
  } catch (err) {
    logger.error({ err }, 'Get group error');
    res.status(500).json({ success: false, error: 'Failed to get group' });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const { name, domain, isActive } = req.body;
    await prisma.group.update({
      where: { id: req.params.id },
      data: { name, domain, isActive: isActive === true || isActive === 'true' },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update group error');
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete group error');
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});

// Users
router.get('/users', async (req, res) => {
  try {
    const groups = await prisma.group.findMany();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { group: true },
    });

    res.render('admin/users', {
      token: res.locals.token,
      users,
      total: users.length,
      groups,
    });
  } catch (err) {
    logger.error({ err }, 'Users error');
    res.render('admin/error', { error: 'Failed to load users', token: res.locals.token });
  }
});

// User CRUD
router.post('/users', async (req, res) => {
  try {
    const { name, email, username, password, role, groupId } = req.body;
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, username, password: hashedPassword, role, groupId },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create user error');
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

router.get('/users/:id/edit', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { group: true },
    });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    logger.error({ err }, 'Get user error');
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, username, role, groupId, isActive, password } = req.body;
    const data: Record<string, unknown> = { name, email, username, role, groupId, isActive: isActive === true || isActive === 'true' };
    if (password) {
      const bcrypt = require('bcrypt');
      data.password = await bcrypt.hash(password, 10);
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update user error');
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete user error');
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});


// Sessions list (Nagging Check-ins)
router.get('/sessions', async (req, res) => {
  try {
    const status = req.query.status as string;
    const topic = req.query.topic as string;
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (topic && topic !== 'all') {
      where.topic = topic;
    }

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.render('admin/sessions', {
      token: res.locals.token,
      sessions,
      statusFilter: status || 'all',
      topicFilter: topic || 'all',
    });
  } catch (err) {
    logger.error({ err }, 'Sessions list error');
    res.render('admin/error', { error: 'Failed to load sessions', token: res.locals.token });
  }
});


// Session Detail (Nagging Check-in)
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
    });

    if (!session) {
      return res.render('admin/error', { error: 'Session not found', token: res.locals.token });
    }

    // Get transcript - now stored as JSON type, not string
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];

    res.render('admin/session-detail', {
      token: res.locals.token,
      session: {
        ...session,
        transcript,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err }, 'Session detail error');
    res.render('admin/error', { error: `Failed to load session: ${errorMsg}`, token: res.locals.token });
  }
});

// Greeting
router.get('/greeting', async (req, res) => {
  try {
    const config = await prisma.appConfig.findFirst();
    res.render('admin/greeting', {
      token: res.locals.token,
      active: 'greeting',
      greeting: config?.greeting || "Hey there, sweetie! It's your friendly reminder assistant. I'm here to help you stay on top of important dates, chores, and all those things you'd otherwise forget. Don't worry, I'll keep you organized! Ready to check in?",
    });
  } catch (err) {
    logger.error({ err }, 'Greeting page error');
    res.render('admin/error', { error: 'Failed to load greeting config', token: res.locals.token });
  }
});

router.post('/greeting', async (req, res) => {
  try {
    const { greeting } = req.body;
    await prisma.appConfig.updateMany({
      data: { greeting }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Greeting update error');
    res.status(500).json({ success: false, error: 'Failed to update greeting' });
  }
});

// Settings - GET (with 3 tabs: Store Info, Branding, Payment Gateways)
router.get('/settings', async (req, res) => {
  try {
    const branding = await getBranding();
    const storeInfo = await prisma.storeInfo.findFirst();
    const paymentSettings = await prisma.paymentSettings.findFirst();

    // Merge all settings for the template
    const settings = {
      // Store Info
      businessName: storeInfo?.businessName || 'Nagging Wife AI',
      tagline: storeInfo?.tagline || '',
      description: storeInfo?.description || '',
      address: storeInfo?.address || '',
      phone: storeInfo?.phone || '',
      email: storeInfo?.email || '',
      website: storeInfo?.website || '',
      businessHours: storeInfo?.businessHours || '',
      timezone: storeInfo?.timezone || 'America/New_York',
      // Branding
      logoUrl: branding?.logoUrl || '',
      faviconUrl: branding?.faviconUrl || '',
      primaryColor: branding?.primaryColor || '#9333ea',
      secondaryColor: branding?.secondaryColor || '#7e22ce',
      accentColor: branding?.accentColor || '#a855f7',
      headingFont: branding?.headingFont || 'Inter',
      bodyFont: branding?.bodyFont || 'Inter',
      // Payment Settings
      paymentsEnabled: paymentSettings?.enabled || false,
      stripeEnabled: paymentSettings?.stripeEnabled || false,
      stripePublishableKey: paymentSettings?.stripePublishableKey || '',
      stripeTestMode: paymentSettings?.stripeTestMode !== false,
      paypalEnabled: paymentSettings?.paypalEnabled || false,
      paypalClientId: paymentSettings?.paypalClientId || '',
      paypalSandbox: paymentSettings?.paypalSandbox !== false,
      squareEnabled: paymentSettings?.squareEnabled || false,
      squareAppId: paymentSettings?.squareAppId || '',
      squareSandbox: paymentSettings?.squareSandbox !== false,
    };

    res.render('admin/settings', {
      token: res.locals.token,
      branding,
      basePath,
      settings,
    });
  } catch (err) {
    logger.error({ err }, 'Settings error');
    res.render('admin/error', { error: 'Failed to load settings', token: res.locals.token, branding: null, basePath });
  }
});

// Settings - POST (save all tabs)
router.post('/settings', async (req, res) => {
  try {
    const {
      // Store Info
      businessName, tagline, description, address, phone, email, website, businessHours, timezone,
      // Branding
      logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont,
      // Payment Settings
      paymentsEnabled, stripeEnabled, stripePublishableKey, stripeSecretKey, stripeTestMode,
      paypalEnabled, paypalClientId, paypalClientSecret, paypalSandbox,
      squareEnabled, squareAppId, squareAccessToken, squareSandbox,
    } = req.body;

    // Update Store Info
    await prisma.storeInfo.upsert({
      where: { id: 'default' },
      update: { businessName, tagline, description, address, phone, email, website, businessHours, timezone },
      create: { id: 'default', businessName, tagline, description, address, phone, email, website, businessHours, timezone },
    });

    // Update Branding
    await prisma.branding.upsert({
      where: { id: 'default' },
      update: { logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont },
      create: { id: 'default', logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont },
    });

    // Update Payment Settings
    await prisma.paymentSettings.upsert({
      where: { id: 'default' },
      update: {
        enabled: paymentsEnabled === true || paymentsEnabled === 'true',
        stripeEnabled: stripeEnabled === true || stripeEnabled === 'true',
        stripePublishableKey: stripePublishableKey || '',
        stripeTestMode: stripeTestMode === true || stripeTestMode === 'true',
        paypalEnabled: paypalEnabled === true || paypalEnabled === 'true',
        paypalClientId: paypalClientId || '',
        paypalSandbox: paypalSandbox === true || paypalSandbox === 'true',
        squareEnabled: squareEnabled === true || squareEnabled === 'true',
        squareAppId: squareAppId || '',
        squareSandbox: squareSandbox === true || squareSandbox === 'true',
      },
      create: {
        id: 'default',
        enabled: paymentsEnabled === true || paymentsEnabled === 'true',
        stripeEnabled: stripeEnabled === true || stripeEnabled === 'true',
        stripePublishableKey: stripePublishableKey || '',
        stripeTestMode: stripeTestMode === true || stripeTestMode === 'true',
        paypalEnabled: paypalEnabled === true || paypalEnabled === 'true',
        paypalClientId: paypalClientId || '',
        paypalSandbox: paypalSandbox === true || paypalSandbox === 'true',
        squareEnabled: squareEnabled === true || squareEnabled === 'true',
        squareAppId: squareAppId || '',
        squareSandbox: squareSandbox === true || squareSandbox === 'true',
      },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Settings save error');
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// Features - GET
router.get('/features', async (req, res) => {
  try {
    const branding = await getBranding();
    const features = await prisma.features.findFirst();

    res.render('admin/features', {
      token: res.locals.token,
      branding,
      basePath,
      features: features || {},
    });
  } catch (err) {
    logger.error({ err }, 'Features error');
    res.render('admin/error', { error: 'Failed to load features', token: res.locals.token, branding: null, basePath });
  }
});

// Features - POST
router.post('/features', async (req, res) => {
  try {
    const {
      faqEnabled, stickyBarEnabled, stickyBarText, stickyBarColor, stickyBarLink, stickyBarLinkText,
      liveChatEnabled, chatProvider, chatWelcomeMessage, chatAgentName, chatWidgetColor, chatPosition, chatShowOnMobile, chatWidgetId, chatEmbedCode,
      emailNotifications, smsNotifications, pushNotifications, orderConfirmations, marketingEmails, appointmentReminders,
      facebookUrl, twitterUrl, instagramUrl, linkedinUrl, youtubeUrl, tiktokUrl,
      shareOnFacebook, shareOnTwitter, shareOnLinkedin, shareOnWhatsapp, shareOnEmail, copyLinkButton,
    } = req.body;

    await prisma.features.upsert({
      where: { id: 'default' },
      update: {
        faqEnabled: faqEnabled === true || faqEnabled === 'true',
        stickyBarEnabled: stickyBarEnabled === true || stickyBarEnabled === 'true',
        stickyBarText: stickyBarText || '',
        stickyBarBgColor: stickyBarColor || '#9333ea',
        stickyBarLink: stickyBarLink || '',
        stickyBarLinkText: stickyBarLinkText || '',
        liveChatEnabled: liveChatEnabled === true || liveChatEnabled === 'true',
        chatProvider: chatProvider || 'builtin',
        chatWelcomeMessage: chatWelcomeMessage || '',
        chatAgentName: chatAgentName || 'Support',
        chatWidgetColor: chatWidgetColor || '#9333ea',
        chatPosition: chatPosition || 'bottom-right',
        chatShowOnMobile: chatShowOnMobile === true || chatShowOnMobile === 'true',
        chatWidgetId: chatWidgetId || '',
        chatEmbedCode: chatEmbedCode || '',
        emailNotifications: emailNotifications === true || emailNotifications === 'true',
        smsNotifications: smsNotifications === true || smsNotifications === 'true',
        pushNotifications: pushNotifications === true || pushNotifications === 'true',
        orderConfirmations: orderConfirmations === true || orderConfirmations === 'true',
        marketingEmails: marketingEmails === true || marketingEmails === 'true',
        appointmentReminders: appointmentReminders === true || appointmentReminders === 'true',
        facebookUrl: facebookUrl || '',
        twitterUrl: twitterUrl || '',
        instagramUrl: instagramUrl || '',
        linkedinUrl: linkedinUrl || '',
        youtubeUrl: youtubeUrl || '',
        tiktokUrl: tiktokUrl || '',
        shareOnFacebook: shareOnFacebook === true || shareOnFacebook === 'true',
        shareOnTwitter: shareOnTwitter === true || shareOnTwitter === 'true',
        shareOnLinkedin: shareOnLinkedin === true || shareOnLinkedin === 'true',
        shareOnWhatsapp: shareOnWhatsapp === true || shareOnWhatsapp === 'true',
        shareOnEmail: shareOnEmail === true || shareOnEmail === 'true',
        copyLinkButton: copyLinkButton === true || copyLinkButton === 'true',
      },
      create: {
        id: 'default',
        faqEnabled: faqEnabled === true || faqEnabled === 'true',
        stickyBarEnabled: stickyBarEnabled === true || stickyBarEnabled === 'true',
        stickyBarText: stickyBarText || '',
        stickyBarBgColor: stickyBarColor || '#9333ea',
        stickyBarLink: stickyBarLink || '',
        stickyBarLinkText: stickyBarLinkText || '',
        liveChatEnabled: liveChatEnabled === true || liveChatEnabled === 'true',
        chatProvider: chatProvider || 'builtin',
        chatWelcomeMessage: chatWelcomeMessage || '',
        chatAgentName: chatAgentName || 'Support',
        chatWidgetColor: chatWidgetColor || '#9333ea',
        chatPosition: chatPosition || 'bottom-right',
        chatShowOnMobile: chatShowOnMobile === true || chatShowOnMobile === 'true',
        chatWidgetId: chatWidgetId || '',
        chatEmbedCode: chatEmbedCode || '',
        emailNotifications: emailNotifications === true || emailNotifications === 'true',
        smsNotifications: smsNotifications === true || smsNotifications === 'true',
        pushNotifications: pushNotifications === true || pushNotifications === 'true',
        orderConfirmations: orderConfirmations === true || orderConfirmations === 'true',
        marketingEmails: marketingEmails === true || marketingEmails === 'true',
        appointmentReminders: appointmentReminders === true || appointmentReminders === 'true',
        facebookUrl: facebookUrl || '',
        twitterUrl: twitterUrl || '',
        instagramUrl: instagramUrl || '',
        linkedinUrl: linkedinUrl || '',
        youtubeUrl: youtubeUrl || '',
        tiktokUrl: tiktokUrl || '',
        shareOnFacebook: shareOnFacebook === true || shareOnFacebook === 'true',
        shareOnTwitter: shareOnTwitter === true || shareOnTwitter === 'true',
        shareOnLinkedin: shareOnLinkedin === true || shareOnLinkedin === 'true',
        shareOnWhatsapp: shareOnWhatsapp === true || shareOnWhatsapp === 'true',
        shareOnEmail: shareOnEmail === true || shareOnEmail === 'true',
        copyLinkButton: copyLinkButton === true || copyLinkButton === 'true',
      },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Features save error');
    res.status(500).json({ success: false, error: 'Failed to save features' });
  }
});

// AI Config
router.get('/ai-config', async (req, res) => {
  try {
    const config = await prisma.appConfig.findFirst();
    res.render('admin/ai-config', {
      token: res.locals.token,
      config,
    });
  } catch (err) {
    logger.error({ err }, 'AI Config error');
    res.render('admin/error', { error: 'Failed to load AI config', token: res.locals.token });
  }
});

// AI Agents
router.get('/ai-agents', async (req, res) => {
  try {
    const agents = await prisma.aIAgent.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.render('admin/ai-agents', {
      token: res.locals.token,
      agents,
    });
  } catch (err) {
    logger.error({ err }, 'AI Agents error');
    res.render('admin/error', { error: 'Failed to load AI agents', token: res.locals.token });
  }
});

// AI Tools
router.get('/ai-tools', async (req, res) => {
  try {
    const tools = await prisma.aITool.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.render('admin/ai-tools', {
      token: res.locals.token,
      tools,
    });
  } catch (err) {
    logger.error({ err }, 'AI Tools error');
    res.render('admin/error', { error: 'Failed to load AI tools', token: res.locals.token });
  }
});

// ============================================
// Voices & Languages Configuration
// ============================================

router.get('/voices', async (req, res) => {
  try {
    const config = await prisma.appConfig.findFirst();

    let languages = await prisma.language.findMany({
      orderBy: { name: 'asc' }
    });

    // Create all 24 languages if none exist (all enabled by default)
    if (languages.length === 0) {
      const defaultLangs = [
        { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', enabled: true },
        { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', enabled: true },
        { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', enabled: true },
        { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', enabled: true },
        { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', enabled: true },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', enabled: true },
        { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文', flag: '🇨🇳', enabled: true },
        { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', enabled: true },
        { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', enabled: true },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', enabled: true },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', enabled: true },
        { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', enabled: true },
        { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', enabled: true },
        { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', enabled: true },
        { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', enabled: true },
        { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', enabled: true },
        { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', enabled: true },
        { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', enabled: true },
        { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', enabled: true },
        { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', enabled: true },
        { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', enabled: true },
        { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', enabled: true },
        { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', enabled: true },
        { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', enabled: true },
      ];

      for (const lang of defaultLangs) {
        await prisma.language.create({ data: lang });
      }

      languages = await prisma.language.findMany({
        orderBy: { name: 'asc' }
      });
    }

    // Add docCount for each language
    const languagesWithDocs = languages.map(lang => ({
      ...lang,
      docCount: 0
    }));
    res.render('admin/voices', {
      token: res.locals.token,
      active: 'voices',
      config: config || { selectedVoice: 'alloy', assistantMode: 'nagging', reminderFrequency: 'daily' },
      languages: languagesWithDocs,
      totalDocs: 0
    });
  } catch (err) {
    logger.error({ err }, 'Voices page error');
    res.render('admin/error', { error: 'Failed to load voices config', token: res.locals.token });
  }
});

router.post('/voices/select', async (req, res) => {
  try {
    const { voice } = req.body;
    await prisma.appConfig.updateMany({
      data: { selectedVoice: voice }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Voice select error');
    res.status(500).json({ success: false, error: 'Failed to update voice' });
  }
});

router.post('/voices/mode', async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['helpful', 'firm', 'gentle', 'nagging'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Invalid mode' });
    }
    await prisma.appConfig.updateMany({
      data: { assistantMode: mode }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Mode update error');
    res.status(500).json({ success: false, error: 'Failed to update mode' });
  }
});
router.post('/voices/difficulty', async (req, res) => {  try {    const { difficulty } = req.body;    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {      return res.status(400).json({ success: false, error: 'Invalid difficulty' });    }    res.json({ success: true });  } catch (err) {    logger.error({ err }, 'Difficulty update error');    res.status(500).json({ success: false, error: 'Failed to update difficulty' });  }});

router.post('/voices/language', async (req, res) => {
  try {
    const { code } = req.body;

    // Language data mapping (all 24 languages)
    const langData: Record<string, { name: string; nativeName: string; flag: string }> = {
      en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
      es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
      fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
      de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
      it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
      pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
      zh: { name: 'Chinese (Mandarin)', nativeName: '中文', flag: '🇨🇳' },
      ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
      ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
      ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
      hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
      ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
      vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
      pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
      nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
      uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
      tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
      th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
      sv: { name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
      cs: { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
      el: { name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
      he: { name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
      id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
      fil: { name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
    };

    const data = langData[code];
    if (!data) {
      return res.redirect(`/admin/voices?token=${res.locals.token}&error=Invalid language code`);
    }

    const existing = await prisma.language.findUnique({ where: { code } });
    if (existing) {
      return res.redirect(`/admin/voices?token=${res.locals.token}&error=Language already exists`);
    }

    await prisma.language.create({
      data: { code, ...data, enabled: true }
    });
    res.redirect(`/admin/voices?token=${res.locals.token}`);
  } catch (err) {
    logger.error({ err }, 'Add language error');
    res.redirect(`/admin/voices?token=${res.locals.token}&error=Failed to add language`);
  }
});

router.post('/voices/language/:id', async (req, res) => {
  try {
    const { enabled } = req.body;
    await prisma.language.update({
      where: { id: req.params.id },
      data: { enabled: enabled === true || enabled === 'true' }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle language error');
    res.status(500).json({ success: false, error: 'Failed to toggle language' });
  }
});

router.delete('/voices/language/:id', async (req, res) => {
  try {
    await prisma.language.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete language error');
    res.status(500).json({ success: false, error: 'Failed to delete language' });
  }
});

// ============================================
// Knowledge Base
// ============================================
router.get('/knowledge-base', async (req, res) => {
  try {
    const languages = await prisma.language.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' }
    });

    const currentLanguage = req.query.language as string || '';

    // Sample KB documents (in production, this would come from a KnowledgeDocument model)
    const sampleDocuments = [
      { id: 'kb-1', name: 'Wife\'s Favorite Things', description: 'Reference guide for gift ideas and preferences', type: 'pdf', size: '1.2 MB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-01'), content: 'Favorite colors: Purple, Teal. Favorite flowers: Roses, Lilies. Jewelry preference: Gold. Clothing size: Medium...' },
      { id: 'kb-2', name: 'Important Family Dates', description: 'All birthdays, anniversaries, and special occasions', type: 'pdf', size: '856 KB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-05'), content: 'Wife\'s birthday: March 15. Anniversary: June 22. Kids birthdays: Emma - Sept 3, Bobby - Dec 18...' },
      { id: 'kb-3', name: 'Home Maintenance Schedule', description: 'Regular chores and maintenance tasks', type: 'doc', size: '512 KB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-10'), content: 'Weekly: Mow lawn, vacuum, clean bathrooms. Monthly: Change HVAC filters, check smoke detectors...' },
      { id: 'kb-4', name: 'Family Dietary Restrictions', description: 'Food allergies and preferences for meal planning', type: 'pdf', size: '245 KB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-11-15'), content: 'Emma is allergic to peanuts. Wife prefers low-carb. Bobby doesn\'t eat seafood...' },
      { id: 'kb-5', name: 'Guía de Fechas Familiares', description: 'Spanish version of family dates guide', type: 'pdf', size: '720 KB', status: 'processed', languageCode: 'es', languageFlag: '🇪🇸', createdAt: new Date('2024-12-08'), content: 'Cumpleaños de la esposa: 15 de marzo. Aniversario: 22 de junio...' },
      { id: 'kb-6', name: 'Gift Ideas & Budget', description: 'Gift suggestions for various occasions', type: 'doc', size: '380 KB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-11-20'), content: 'Anniversary: Budget $200-300. Jewelry, spa day, weekend getaway. Birthday: Budget $150-200...' },
      { id: 'kb-7', name: '1800Flowers Account', type: 'url', size: '-', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-12'), description: 'Link to flower ordering', content: 'https://1800flowers.com - Rose arrangements, mixed bouquets, delivery options...' },
      { id: 'kb-8', name: 'Emergency Contacts', description: 'Family emergency contact information', type: 'txt', size: '35 KB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-14'), content: 'Wife\'s mom: 555-1234. Pediatrician: 555-5678. Plumber: 555-9012...' },
    ];

    // Filter by language if specified
    const filteredDocuments = currentLanguage
      ? sampleDocuments.filter(d => d.languageCode === currentLanguage)
      : sampleDocuments;

    // Calculate stats
    const totalSizeBytes = filteredDocuments.reduce((sum, d) => {
      const match = d.size.match(/([\d.]+)\s*(KB|MB|GB)?/);
      if (!match) return sum;
      const value = parseFloat(match[1]);
      const unit = match[2] || 'KB';
      const multiplier = unit === 'GB' ? 1024 * 1024 * 1024 : unit === 'MB' ? 1024 * 1024 : 1024;
      return sum + (value * multiplier);
    }, 0);

    const formatSize = (bytes: number) => {
      if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
      if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      return (bytes / 1024).toFixed(1) + ' KB';
    };

    const uniqueLanguages = [...new Set(sampleDocuments.map(d => d.languageCode))];

    res.render('admin/knowledge-base', {
      token: res.locals.token,
      documents: filteredDocuments,
      totalSize: formatSize(totalSizeBytes),
      languageCount: uniqueLanguages.length,
      languages,
      currentLanguage,
    });
  } catch (err) {
    logger.error({ err }, 'Knowledge Base error');
    res.render('admin/error', { error: 'Failed to load knowledge base', token: res.locals.token });
  }
});

// Get single document
router.get('/knowledge-base/:id', async (req, res) => {
  try {
    // Sample document lookup (in production, fetch from DB)
    const sampleDocuments: Record<string, object> = {
      'kb-1': { id: 'kb-1', name: 'Wife\'s Favorite Things', description: 'Reference guide for gift ideas and preferences', type: 'pdf', size: '1.2 MB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-01'), content: 'WIFE\'S PREFERENCES:\n\n1. Colors\n- Favorite: Purple, Teal\n- Avoid: Orange, Brown\n\n2. Flowers\n- Roses (red or pink)\n- Lilies\n- Tulips in spring\n\n3. Jewelry\n- Prefers gold over silver\n- Likes delicate pieces\n- Ring size: 7\n\n4. Clothing\n- Size: Medium (8-10)\n- Shoe size: 8' },
      'kb-2': { id: 'kb-2', name: 'Important Family Dates', description: 'All birthdays, anniversaries, and special occasions', type: 'pdf', size: '856 KB', status: 'processed', languageCode: 'en', languageFlag: '🇺🇸', createdAt: new Date('2024-12-05'), content: 'IMPORTANT DATES:\n\n1. Wife\'s Birthday: March 15\n- Gift budget: $150-200\n- Dinner reservation: Her favorite Italian place\n\n2. Wedding Anniversary: June 22\n- Traditional gift (year): Paper (1st), Cotton (2nd), etc.\n- Budget: $200-300\n\n3. Kids Birthdays:\n- Emma: September 3rd\n- Bobby: December 18th' },
    };

    const doc = sampleDocuments[req.params.id];
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({ success: true, document: doc });
  } catch (err) {
    logger.error({ err }, 'Get KB document error');
    res.status(500).json({ success: false, error: 'Failed to get document' });
  }
});

// Upload documents (placeholder - would need actual file handling)
router.post('/knowledge-base/upload', upload.array('files', 10), async (req, res) => {
  try {
    // In production: process uploaded files, extract text, store in DB
    res.json({ success: true, message: 'Files uploaded successfully' });
  } catch (err) {
    logger.error({ err }, 'KB upload error');
    res.status(500).json({ success: false, error: 'Failed to upload files' });
  }
});

// Add URL
router.post('/knowledge-base/url', async (req, res) => {
  try {
    const { url, name, language, description } = req.body;
    // In production: fetch URL content, extract text, store in DB
    res.json({ success: true, message: 'URL added successfully' });
  } catch (err) {
    logger.error({ err }, 'KB add URL error');
    res.status(500).json({ success: false, error: 'Failed to add URL' });
  }
});

// Delete document
router.delete('/knowledge-base/:id', async (req, res) => {
  try {
    // In production: delete from DB and storage
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'KB delete error');
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

// Reprocess document
router.post('/knowledge-base/:id/reprocess', async (req, res) => {
  try {
    // In production: queue document for reprocessing
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'KB reprocess error');
    res.status(500).json({ success: false, error: 'Failed to reprocess document' });
  }
});

// Bulk delete
router.post('/knowledge-base/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    // In production: delete multiple documents
    res.json({ success: true, deleted: ids?.length || 0 });
  } catch (err) {
    logger.error({ err }, 'KB bulk delete error');
    res.status(500).json({ success: false, error: 'Failed to delete documents' });
  }
});

// Bulk reprocess
router.post('/knowledge-base/bulk-reprocess', async (req, res) => {
  try {
    const { ids } = req.body;
    // In production: queue multiple documents for reprocessing
    res.json({ success: true, queued: ids?.length || 0 });
  } catch (err) {
    logger.error({ err }, 'KB bulk reprocess error');
    res.status(500).json({ success: false, error: 'Failed to reprocess documents' });
  }
});

// Logic Rules
router.get('/logic-rules', async (req, res) => {
  try {
    const rules = await prisma.logicRule.findMany({
      orderBy: { priority: 'desc' },
    });
    res.render('admin/logic-rules', {
      token: res.locals.token,
      rules,
    });
  } catch (err) {
    logger.error({ err }, 'Logic Rules error');
    res.render('admin/error', { error: 'Failed to load logic rules', token: res.locals.token });
  }
});

// Functions
router.get('/functions', async (req, res) => {
  try {
    const functions = await prisma.function.findMany({
      orderBy: { name: 'asc' },
    });
    res.render('admin/functions', {
      token: res.locals.token,
      functions,
    });
  } catch (err) {
    logger.error({ err }, 'Functions error');
    res.render('admin/error', { error: 'Failed to load functions', token: res.locals.token });
  }
});

// SMS Settings
router.get('/sms-settings', async (req, res) => {
  try {
    const settings = await prisma.sMSSettings.findFirst();
    res.render('admin/sms-settings', {
      token: res.locals.token,
      settings,
    });
  } catch (err) {
    logger.error({ err }, 'SMS Settings error');
    res.render('admin/error', { error: 'Failed to load SMS settings', token: res.locals.token });
  }
});

// Webhooks
router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.render('admin/webhooks', {
      token: res.locals.token,
      webhooks,
    });
  } catch (err) {
    logger.error({ err }, 'Webhooks error');
    res.render('admin/error', { error: 'Failed to load webhooks', token: res.locals.token });
  }
});

// Transactions
router.get('/transactions', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const totalRevenue = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    res.render('admin/transactions', {
      token: res.locals.token,
      payments,
      totalRevenue,
    });
  } catch (err) {
    logger.error({ err }, 'Transactions error');
    res.render('admin/error', { error: 'Failed to load transactions', token: res.locals.token });
  }
});

// ============================================
// NAGGING WIFE AI - NEW FEATURES
// ============================================

// Important Dates
router.get('/important-dates', async (req, res) => {
  try {
    const branding = await getBranding();
    const dates = await prisma.importantDate.findMany({
      where: { isActive: true },
      orderBy: { date: 'asc' },
    });
    const birthdayCount = dates.filter(d => d.dateType === 'birthday').length;
    const anniversaryCount = dates.filter(d => d.dateType === 'anniversary').length;
    const today = new Date();
    const upcomingCount = dates.filter(d => {
      const eventDate = new Date(d.date);
      const thisYearDate = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      if (thisYearDate < today) thisYearDate.setFullYear(thisYearDate.getFullYear() + 1);
      const daysUntil = Math.ceil((thisYearDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7;
    }).length;

    res.render('admin/important-dates', {
      token: res.locals.token,
      branding,
      basePath,
      dates,
      totalDates: dates.length,
      birthdayCount,
      anniversaryCount,
      upcomingCount,
    });
  } catch (err) {
    logger.error({ err }, 'Important dates page error');
    res.render('admin/error', { error: 'Failed to load important dates', token: res.locals.token, branding: null, basePath });
  }
});

router.post('/important-dates', async (req, res) => {
  try {
    const { title, person, dateType, date, reminderDays, notes, recurring } = req.body;
    await prisma.importantDate.create({
      data: { title, person, dateType, date: new Date(date), reminderDays: parseInt(reminderDays) || 7, notes, recurring: recurring === true || recurring === 'true' },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create important date error');
    res.status(500).json({ success: false, error: 'Failed to create date' });
  }
});

// Edit important date - GET form
router.get('/important-dates/:id/edit', async (req, res) => {
  try {
    const date = await prisma.importantDate.findUnique({ where: { id: req.params.id } });
    if (!date) {
      return res.status(404).json({ success: false, error: 'Date not found' });
    }
    res.json({ success: true, date });
  } catch (err) {
    logger.error({ err }, 'Get important date error');
    res.status(500).json({ success: false, error: 'Failed to get date' });
  }
});

// Update important date
router.put('/important-dates/:id', async (req, res) => {
  try {
    const { title, person, dateType, date, reminderDays, notes, recurring, giftIdeas } = req.body;
    await prisma.importantDate.update({
      where: { id: req.params.id },
      data: {
        title,
        person,
        dateType,
        date: new Date(date),
        reminderDays: parseInt(reminderDays) || 7,
        notes,
        recurring: recurring === true || recurring === 'true',
        giftIdeas: giftIdeas ? JSON.stringify(giftIdeas) : undefined,
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update important date error');
    res.status(500).json({ success: false, error: 'Failed to update date' });
  }
});

// Gift ideas for important date
router.get('/important-dates/:id/gifts', async (req, res) => {
  try {
    const date = await prisma.importantDate.findUnique({ where: { id: req.params.id } });
    if (!date) {
      return res.render('admin/error', { error: 'Date not found', token: res.locals.token });
    }
    // giftIdeas is now stored as JSON type, not string
    const giftIdeas = Array.isArray(date.giftIdeas) ? date.giftIdeas as string[] : [];
    res.render('admin/gift-ideas', {
      token: res.locals.token,
      date,
      giftIdeas,
    });
  } catch (err) {
    logger.error({ err }, 'Gift ideas error');
    res.render('admin/error', { error: 'Failed to load gift ideas', token: res.locals.token });
  }
});

router.delete('/important-dates/:id', async (req, res) => {
  try {
    await prisma.importantDate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete important date error');
    res.status(500).json({ success: false, error: 'Failed to delete date' });
  }
});

// Wishlist
router.get('/wishlist', async (req, res) => {
  try {
    const branding = await getBranding();
    const category = req.query.category as string;
    const where: any = { isActive: true };
    if (category && category !== 'all') where.category = category;

    const items = await prisma.wishlistItem.findMany({ where, orderBy: { priority: 'desc' } });
    const mustHaveCount = items.filter(i => i.priority === 'must-have').length;
    const highPriorityCount = items.filter(i => i.priority === 'high').length;
    const purchasedCount = items.filter(i => i.isPurchased).length;

    res.render('admin/wishlist', {
      token: res.locals.token,
      branding,
      basePath,
      items,
      totalItems: items.length,
      mustHaveCount,
      highPriorityCount,
      purchasedCount,
    });
  } catch (err) {
    logger.error({ err }, 'Wishlist page error');
    res.render('admin/error', { error: 'Failed to load wishlist', token: res.locals.token, branding: null, basePath });
  }
});

router.post('/wishlist', async (req, res) => {
  try {
    const { name, description, category, priority, priceRange, productUrl, imageUrl, occasion } = req.body;
    await prisma.wishlistItem.create({
      data: { name, description, category, priority, priceRange, productUrl, imageUrl, occasion },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create wishlist item error');
    res.status(500).json({ success: false, error: 'Failed to create item' });
  }
});

router.get('/wishlist/:id/edit', async (req, res) => {
  try {
    const item = await prisma.wishlistItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) {
    logger.error({ err }, 'Get wishlist item error');
    res.status(500).json({ success: false, error: 'Failed to get item' });
  }
});

router.put('/wishlist/:id', async (req, res) => {
  try {
    const { name, description, category, priority, priceRange, productUrl, imageUrl, occasion, isPurchased, notes } = req.body;
    await prisma.wishlistItem.update({
      where: { id: req.params.id },
      data: { name, description, category, priority, priceRange, productUrl, imageUrl, occasion, isPurchased, notes },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update wishlist item error');
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

router.delete('/wishlist/:id', async (req, res) => {
  try {
    await prisma.wishlistItem.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete wishlist item error');
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// Bulk mark wishlist items as purchased
router.post('/wishlist/mark-purchased', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.wishlistItem.updateMany({
      where: { id: { in: ids } },
      data: { isPurchased: true },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk mark purchased error');
    res.status(500).json({ success: false, error: 'Failed to mark items' });
  }
});

// Bulk delete wishlist items
router.post('/wishlist/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.wishlistItem.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk delete wishlist error');
    res.status(500).json({ success: false, error: 'Failed to delete items' });
  }
});

// Chores & Honey-Do's
router.get('/chores', async (req, res) => {
  try {
    const branding = await getBranding();
    const status = req.query.status as string;
    const where: any = { isActive: true };
    if (status && status !== 'all') where.status = status;

    const chores = await prisma.chore.findMany({ where, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }] });
    const today = new Date();
    const overdueCount = chores.filter(c => c.dueDate && new Date(c.dueDate) < today && c.status !== 'completed').length;
    const pendingCount = chores.filter(c => c.status === 'pending').length;
    const inProgressCount = chores.filter(c => c.status === 'in_progress').length;
    const completedCount = chores.filter(c => c.status === 'completed').length;

    res.render('admin/chores', {
      token: res.locals.token,
      branding,
      basePath,
      chores,
      overdueCount,
      pendingCount,
      inProgressCount,
      completedCount,
    });
  } catch (err) {
    logger.error({ err }, 'Chores page error');
    res.render('admin/error', { error: 'Failed to load chores', token: res.locals.token, branding: null, basePath });
  }
});

router.post('/chores', async (req, res) => {
  try {
    const { title, description, category, priority, assignedTo, dueDate, reminderDate, estimatedTime, recurring } = req.body;
    await prisma.chore.create({
      data: {
        title, description, category, priority, assignedTo,
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        recurring: recurring || null,
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create chore error');
    res.status(500).json({ success: false, error: 'Failed to create chore' });
  }
});

router.get('/chores/:id/edit', async (req, res) => {
  try {
    const chore = await prisma.chore.findUnique({ where: { id: req.params.id } });
    if (!chore) return res.status(404).json({ success: false, error: 'Chore not found' });
    res.json({ success: true, chore });
  } catch (err) {
    logger.error({ err }, 'Get chore error');
    res.status(500).json({ success: false, error: 'Failed to get chore' });
  }
});

router.put('/chores/:id', async (req, res) => {
  try {
    const { title, description, category, priority, assignedTo, dueDate, reminderDate, estimatedTime, recurring, status, notes } = req.body;
    await prisma.chore.update({
      where: { id: req.params.id },
      data: {
        title, description, category, priority, assignedTo, status, notes,
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        recurring: recurring || null,
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update chore error');
    res.status(500).json({ success: false, error: 'Failed to update chore' });
  }
});

router.post('/chores/:id/complete', async (req, res) => {
  try {
    await prisma.chore.update({
      where: { id: req.params.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Complete chore error');
    res.status(500).json({ success: false, error: 'Failed to complete chore' });
  }
});

router.delete('/chores/:id', async (req, res) => {
  try {
    await prisma.chore.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete chore error');
    res.status(500).json({ success: false, error: 'Failed to delete chore' });
  }
});

// Bulk chore operations
router.post('/chores/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.chore.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk delete chores error');
    res.status(500).json({ success: false, error: 'Failed to delete chores' });
  }
});

router.post('/chores/bulk-complete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.chore.updateMany({
      where: { id: { in: ids } },
      data: { status: 'completed', completedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk complete chores error');
    res.status(500).json({ success: false, error: 'Failed to complete chores' });
  }
});

// Gift Orders - new order from wishlist
router.get('/gift-orders/new', async (req, res) => {
  try {
    const branding = await getBranding();
    const wishlistItemId = req.query.wishlistItemId as string;
    let wishlistItem = null;
    if (wishlistItemId) {
      wishlistItem = await prisma.wishlistItem.findUnique({ where: { id: wishlistItemId } });
    }

    const orders = await prisma.giftOrder.findMany({ orderBy: { createdAt: 'desc' } });
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;
    const deliveredCount = orders.filter(o => o.status === 'delivered').length;
    const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.amount), 0);

    res.render('admin/gift-orders', {
      token: res.locals.token,
      branding,
      basePath,
      orders,
      pendingCount,
      shippedCount,
      deliveredCount,
      totalSpent,
      prefillItem: wishlistItem,
    });
  } catch (err) {
    logger.error({ err }, 'Gift orders new page error');
    res.render('admin/error', { error: 'Failed to load gift orders', token: res.locals.token, branding: null, basePath });
  }
});

router.get('/gift-orders', async (req, res) => {
  try {
    const branding = await getBranding();
    const orders = await prisma.giftOrder.findMany({ orderBy: { createdAt: 'desc' } });
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;
    const deliveredCount = orders.filter(o => o.status === 'delivered').length;
    const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.amount), 0);

    res.render('admin/gift-orders', {
      token: res.locals.token,
      branding,
      basePath,
      orders,
      pendingCount,
      shippedCount,
      deliveredCount,
      totalSpent,
    });
  } catch (err) {
    logger.error({ err }, 'Gift orders page error');
    res.render('admin/error', { error: 'Failed to load gift orders', token: res.locals.token, branding: null, basePath });
  }
});

router.post('/gift-orders', async (req, res) => {
  try {
    const { recipientName, occasion, giftName, description, vendor, amount, orderType, deliveryDate } = req.body;
    await prisma.giftOrder.create({
      data: {
        recipientName, occasion, giftName, description, vendor,
        amount: parseFloat(amount),
        orderType: orderType || 'product',
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create gift order error');
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

router.get('/gift-orders/:id/edit', async (req, res) => {
  try {
    const order = await prisma.giftOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    logger.error({ err }, 'Get gift order error');
    res.status(500).json({ success: false, error: 'Failed to get order' });
  }
});

router.put('/gift-orders/:id', async (req, res) => {
  try {
    const { recipientName, occasion, giftName, description, vendor, amount, orderType, status, trackingNumber, deliveryDate, notes } = req.body;
    await prisma.giftOrder.update({
      where: { id: req.params.id },
      data: {
        recipientName, occasion, giftName, description, vendor, orderType, status, trackingNumber, notes,
        amount: amount ? parseFloat(amount) : undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update gift order error');
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

router.delete('/gift-orders/:id', async (req, res) => {
  try {
    await prisma.giftOrder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete gift order error');
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

// Bulk gift order operations
router.post('/gift-orders/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.giftOrder.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk delete gift orders error');
    res.status(500).json({ success: false, error: 'Failed to delete orders' });
  }
});

// Seasonal Reminders
router.get('/seasonal-reminders', async (req, res) => {
  try {
    const season = req.query.season as string;
    const where: any = {};
    if (season && season !== 'all') where.season = season;

    const reminders = await prisma.seasonalReminder.findMany({ where, orderBy: { season: 'asc' } });
    const activeCount = reminders.filter(r => r.isActive).length;
    const upcomingCount = reminders.length; // Simplified
    const giftIdeasCount = reminders.reduce((sum, r) => sum + (Array.isArray(r.giftSuggestions) ? r.giftSuggestions.length : 0), 0);

    res.render('admin/seasonal-reminders', {
      token: res.locals.token,
      reminders,
      activeCount,
      upcomingCount,
      giftIdeasCount,
    });
  } catch (err) {
    logger.error({ err }, 'Seasonal reminders page error');
    res.render('admin/error', { error: 'Failed to load seasonal reminders', token: res.locals.token });
  }
});

router.post('/seasonal-reminders', async (req, res) => {
  try {
    const { name, description, season, reminderDays, message, adCategory, isActive } = req.body;
    await prisma.seasonalReminder.create({
      data: { name, description, season, reminderDays: parseInt(reminderDays) || 14, message, adCategory, isActive: isActive === true || isActive === 'true' },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create seasonal reminder error');
    res.status(500).json({ success: false, error: 'Failed to create reminder' });
  }
});

router.get('/seasonal-reminders/:id/edit', async (req, res) => {
  try {
    const reminder = await prisma.seasonalReminder.findUnique({ where: { id: req.params.id } });
    if (!reminder) return res.status(404).json({ success: false, error: 'Reminder not found' });
    res.json({ success: true, reminder });
  } catch (err) {
    logger.error({ err }, 'Get seasonal reminder error');
    res.status(500).json({ success: false, error: 'Failed to get reminder' });
  }
});

router.put('/seasonal-reminders/:id', async (req, res) => {
  try {
    const { name, description, season, reminderDays, message, giftSuggestions, adCategory, isActive } = req.body;
    await prisma.seasonalReminder.update({
      where: { id: req.params.id },
      data: {
        name, description, season, message, adCategory,
        reminderDays: parseInt(reminderDays) || 14,
        giftSuggestions: giftSuggestions ? JSON.stringify(giftSuggestions) : undefined,
        isActive: isActive === true || isActive === 'true',
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update seasonal reminder error');
    res.status(500).json({ success: false, error: 'Failed to update reminder' });
  }
});

router.delete('/seasonal-reminders/:id', async (req, res) => {
  try {
    await prisma.seasonalReminder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete seasonal reminder error');
    res.status(500).json({ success: false, error: 'Failed to delete reminder' });
  }
});

// Bulk seasonal reminder operations
router.post('/seasonal-reminders/bulk-enable', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.seasonalReminder.updateMany({
      where: { id: { in: ids } },
      data: { isActive: true },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk enable reminders error');
    res.status(500).json({ success: false, error: 'Failed to enable reminders' });
  }
});

router.post('/seasonal-reminders/bulk-disable', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.seasonalReminder.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk disable reminders error');
    res.status(500).json({ success: false, error: 'Failed to disable reminders' });
  }
});

router.post('/seasonal-reminders/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.seasonalReminder.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk delete reminders error');
    res.status(500).json({ success: false, error: 'Failed to delete reminders' });
  }
});

// Ads - redirect to ads-management
router.get('/ads', (req, res) => {
  res.redirect(`/admin/ads-management?token=${res.locals.token}`);
});

// Ads Management
router.get('/ads-management', async (req, res) => {
  try {
    const category = req.query.category as string;
    const where: any = {};
    if (category && category !== 'all') where.category = category;

    const ads = await prisma.ad.findMany({ where, orderBy: { priority: 'desc' } });
    const activeCount = ads.filter(a => a.isActive).length;
    const totalImpressions = ads.reduce((sum, a) => sum + a.impressions, 0);
    const totalClicks = ads.reduce((sum, a) => sum + a.clickCount, 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

    res.render('admin/ads-management', {
      token: res.locals.token,
      ads,
      activeCount,
      totalImpressions,
      totalClicks,
      avgCtr,
    });
  } catch (err) {
    logger.error({ err }, 'Ads management page error');
    res.render('admin/error', { error: 'Failed to load ads', token: res.locals.token });
  }
});

router.post('/ads-management', async (req, res) => {
  try {
    const { title, description, category, imageUrl, linkUrl, advertiser, startDate, endDate, priority, placement, isActive } = req.body;
    await prisma.ad.create({
      data: {
        title, description, category, imageUrl, linkUrl, advertiser, placement,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        priority: parseInt(priority) || 0,
        isActive: isActive === true || isActive === 'true',
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create ad error');
    res.status(500).json({ success: false, error: 'Failed to create ad' });
  }
});

router.get('/ads-management/:id/edit', async (req, res) => {
  try {
    const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
    if (!ad) return res.status(404).json({ success: false, error: 'Ad not found' });
    res.json({ success: true, ad });
  } catch (err) {
    logger.error({ err }, 'Get ad error');
    res.status(500).json({ success: false, error: 'Failed to get ad' });
  }
});

router.put('/ads-management/:id', async (req, res) => {
  try {
    const { title, description, category, imageUrl, linkUrl, advertiser, startDate, endDate, priority, placement, isActive } = req.body;
    await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        title, description, category, imageUrl, linkUrl, advertiser, placement,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        priority: priority !== undefined ? parseInt(priority) : undefined,
        isActive: isActive === true || isActive === 'true',
      },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update ad error');
    res.status(500).json({ success: false, error: 'Failed to update ad' });
  }
});

router.delete('/ads-management/:id', async (req, res) => {
  try {
    await prisma.ad.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete ad error');
    res.status(500).json({ success: false, error: 'Failed to delete ad' });
  }
});

// Bulk ads operations
router.post('/ads-management/bulk-enable', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.ad.updateMany({
      where: { id: { in: ids } },
      data: { isActive: true },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk enable ads error');
    res.status(500).json({ success: false, error: 'Failed to enable ads' });
  }
});

router.post('/ads-management/bulk-disable', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.ad.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk disable ads error');
    res.status(500).json({ success: false, error: 'Failed to disable ads' });
  }
});

router.post('/ads-management/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    await prisma.ad.deleteMany({ where: { id: { in: ids } } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Bulk delete ads error');
    res.status(500).json({ success: false, error: 'Failed to delete ads' });
  }
});

// Payment Gateways Configuration
router.get('/payment-gateways', async (req, res) => {
  try {
    const gateways = await prisma.paymentGateway.findMany();
    res.render('admin/payment-gateways', {
      token: res.locals.token,
      gateways,
      basePath,
    });
  } catch (err) {
    logger.error({ err }, 'Payment gateways page error');
    res.render('admin/error', { error: 'Failed to load payment gateways', token: res.locals.token });
  }
});

router.post('/payment-gateways', async (req, res) => {
  try {
    const { stripe, paypal, braintree, square, authorize } = req.body;

    // Upsert Stripe
    if (stripe) {
      await prisma.paymentGateway.upsert({
        where: { provider: 'stripe' },
        update: {
          isEnabled: stripe.enabled,
          publishableKey: stripe.publishableKey,
          secretKey: stripe.secretKey || undefined,
          webhookSecret: stripe.webhookSecret || undefined,
          testMode: stripe.testMode,
          achEnabled: stripe.achEnabled,
        },
        create: {
          provider: 'stripe',
          isEnabled: stripe.enabled,
          publishableKey: stripe.publishableKey,
          secretKey: stripe.secretKey,
          webhookSecret: stripe.webhookSecret,
          testMode: stripe.testMode,
          achEnabled: stripe.achEnabled,
        },
      });
    }

    // Upsert PayPal
    if (paypal) {
      await prisma.paymentGateway.upsert({
        where: { provider: 'paypal' },
        update: {
          isEnabled: paypal.enabled,
          clientId: paypal.clientId,
          clientSecret: paypal.clientSecret || undefined,
          webhookId: paypal.webhookId || undefined,
          testMode: paypal.testMode,
        },
        create: {
          provider: 'paypal',
          isEnabled: paypal.enabled,
          clientId: paypal.clientId,
          clientSecret: paypal.clientSecret,
          webhookId: paypal.webhookId,
          testMode: paypal.testMode,
        },
      });
    }

    // Upsert Braintree
    if (braintree) {
      await prisma.paymentGateway.upsert({
        where: { provider: 'braintree' },
        update: {
          isEnabled: braintree.enabled,
          merchantId: braintree.merchantId,
          publicKey: braintree.publicKey,
          privateKey: braintree.privateKey || undefined,
          testMode: braintree.testMode,
        },
        create: {
          provider: 'braintree',
          isEnabled: braintree.enabled,
          merchantId: braintree.merchantId,
          publicKey: braintree.publicKey,
          privateKey: braintree.privateKey,
          testMode: braintree.testMode,
        },
      });
    }

    // Upsert Square
    if (square) {
      await prisma.paymentGateway.upsert({
        where: { provider: 'square' },
        update: {
          isEnabled: square.enabled,
          applicationId: square.applicationId,
          accessToken: square.accessToken || undefined,
          locationId: square.locationId,
          webhookSignatureKey: square.webhookSignatureKey || undefined,
          testMode: square.testMode,
        },
        create: {
          provider: 'square',
          isEnabled: square.enabled,
          applicationId: square.applicationId,
          accessToken: square.accessToken,
          locationId: square.locationId,
          webhookSignatureKey: square.webhookSignatureKey,
          testMode: square.testMode,
        },
      });
    }

    // Upsert Authorize.net
    if (authorize) {
      await prisma.paymentGateway.upsert({
        where: { provider: 'authorize' },
        update: {
          isEnabled: authorize.enabled,
          apiLoginId: authorize.apiLoginId,
          transactionKey: authorize.transactionKey || undefined,
          signatureKey: authorize.signatureKey || undefined,
          testMode: authorize.testMode,
        },
        create: {
          provider: 'authorize',
          isEnabled: authorize.enabled,
          apiLoginId: authorize.apiLoginId,
          transactionKey: authorize.transactionKey,
          signatureKey: authorize.signatureKey,
          testMode: authorize.testMode,
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Save payment gateways error');
    res.status(500).json({ success: false, error: 'Failed to save payment gateways' });
  }
});

export default router;
