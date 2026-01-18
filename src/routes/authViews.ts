import { Router, Request, Response } from 'express';

const router = Router();
const basePath = process.env.BASE_PATH || '/NaggingWife';

/**
 * GET /auth/login
 * Login page
 */
router.get('/login', (req: Request, res: Response) => {
  const { registered, verified, reset } = req.query;
  res.render('auth/login', {
    registered: registered === 'true',
    verified: verified === 'true',
    reset: reset === 'true',
    basePath,
  });
});

/**
 * GET /auth/register
 * Registration page
 */
router.get('/register', (_req: Request, res: Response) => {
  res.render('auth/register', { basePath });
});

/**
 * GET /auth/forgot-password
 * Forgot password page
 */
router.get('/forgot-password', (_req: Request, res: Response) => {
  res.render('auth/forgot-password', { basePath });
});

/**
 * GET /auth/reset-password
 * Reset password page (expects ?token=xxx)
 */
router.get('/reset-password', (_req: Request, res: Response) => {
  res.render('auth/reset-password', { basePath });
});

/**
 * GET /auth/verify-email
 * Email verification result page
 */
router.get('/verify-email', (_req: Request, res: Response) => {
  res.render('auth/verify-email', { basePath });
});

export default router;
