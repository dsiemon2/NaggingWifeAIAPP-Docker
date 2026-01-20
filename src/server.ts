import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pino from 'pino';
import http from 'http';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger.js';

// API Routes
import authRouter from './routes/auth.js';
import authViewsRouter from './routes/authViews.js';
import oauthRouter from './routes/oauth.js';
import healthRouter from './routes/health.js';
import passport from 'passport';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(passport.initialize());

app.set('views', 'views');
app.set('view engine', 'ejs');

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/oauth', oauthRouter);

// Health check
app.use('/healthz', healthRouter);

// Auth view routes (login, register, etc.)
app.use('/auth', authViewsRouter);

// Base path for Docker deployment
const basePath = process.env.BASE_PATH || '/NaggingWife';

// Chat route (requires authentication)
app.get('/chat', async (req, res) => {
  const token = req.query.token as string;

  if (!token) {
    return res.redirect(`${basePath}/auth/login`);
  }

  try {
    const jwt = await import('jsonwebtoken');
    const config = await import('./config/index.js');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const payload = jwt.default.verify(token, config.default.jwtSecret);

    // Fetch features for announcement bar
    const features = await prisma.features.findFirst({
      where: { id: 'default' }
    });

    res.render('user-chat', {
      basePath,
      token,
      user: payload,
      appName: 'Nagging Wife AI',
      features: features || null
    });
  } catch (error) {
    return res.redirect(`${basePath}/auth/login?error=invalid_token`);
  }
});

// Account route (requires authentication)
app.get('/account', async (req, res) => {
  const token = req.query.token as string;

  if (!token) {
    return res.redirect(`${basePath}/auth/login`);
  }

  try {
    const jwt = await import('jsonwebtoken');
    const config = await import('./config/index.js');
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const payload = jwt.default.verify(token, config.default.jwtSecret) as any;

    // Fetch user with account data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        group: true,
        paymentMethods: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        notificationPrefs: true,
        devices: { orderBy: { lastSeenAt: 'desc' } }
      }
    });

    if (!user) {
      return res.redirect(`${basePath}/auth/login?error=user_not_found`);
    }

    // Get branding
    const branding = await prisma.branding.findFirst({ where: { id: 'default' } });

    res.render('account', {
      basePath,
      token,
      user,
      branding: branding || {},
      paymentMethods: user.paymentMethods,
      notificationPrefs: user.notificationPrefs,
      devices: user.devices.map(d => ({ ...d, isCurrent: d.ipAddress === req.ip })),
      subscription: null // Group subscription if applicable
    });
    await prisma.$disconnect();
  } catch (error) {
    return res.redirect(`${basePath}/auth/login?error=invalid_token`);
  }
});

// Main app route - Landing page
app.get('/', async (_req, res) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    // Get active ads for landing page
    const announcements = await prisma.ad.findMany({
      where: { isActive: true, placement: 'announcement-bar' },
      orderBy: { priority: 'desc' },
      take: 3
    });
    const bannerAds = await prisma.ad.findMany({
      where: { isActive: true, placement: 'banner' },
      orderBy: { priority: 'desc' },
      take: 2
    });
    const heroAd = await prisma.ad.findFirst({
      where: { isActive: true, placement: 'hero' },
      orderBy: { priority: 'desc' }
    });
    const sidebarAds = await prisma.ad.findMany({
      where: { isActive: true, placement: 'sidebar' },
      orderBy: { priority: 'desc' },
      take: 6
    });
    res.render('index', {
      title: 'Nagging Wife AI - Happy Wife, Happy Life',
      basePath,
      announcements,
      bannerAds,
      heroAd,
      sidebarAds
    });
  } catch (error) {
    res.render('index', {
      title: 'Nagging Wife AI - Happy Wife, Happy Life',
      basePath,
      announcements: [],
      bannerAds: [],
      heroAd: null,
      sidebarAds: []
    });
  } finally {
    await prisma.$disconnect();
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 8010;
const server = http.createServer(app);

server.listen(port, () => {
  logger.info(`Nagging Wife AI running on :${port}`);
  logger.info(`Landing page: http://localhost:${port}/`);
});
