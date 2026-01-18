import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pino from 'pino';
import cookieParser from 'cookie-parser';

// API Routes
import authRouter from './routes/auth.js';
import superAdminRouter from './routes/superAdmin.js';
import usersRouter from './routes/users.js';

// Admin routes
import adminRouter from './routes/admin.js';

const app = express();
const logger = pino();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.set('views', 'views');
app.set('view engine', 'ejs');

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/super-admin', superAdminRouter);
app.use('/api/users', usersRouter);

// Admin routes (for UI)
app.use('/admin', adminRouter);

// Redirect root to admin
app.get('/', (req, res) => {
  const token = process.env.ADMIN_TOKEN || 'admin';
  res.redirect(`/admin?token=${token}`);
});

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', app: 'Nagging Wife AI' });
});

const port = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 8071;

app.listen(port, () => {
  logger.info(`Nagging Wife AI - Admin Panel running on :${port}`);
  logger.info(`Admin URL: http://localhost:${port}/admin?token=${process.env.ADMIN_TOKEN || 'admin'}`);
  logger.info(`API Base: http://localhost:${port}/api`);
});
