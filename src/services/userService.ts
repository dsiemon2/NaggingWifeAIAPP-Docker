import { prisma } from '../db/prisma.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { Role, PaginationParams, PaginatedResponse } from '../types/index.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  groupId?: string | null;
  birthDate?: Date | null;
}

export interface RegisterUserInput {
  email: string;
  username?: string;
  password: string;
  name: string;
  groupId: string;
  birthDate?: Date;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
  birthDate?: Date | null;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput) {
  const { email, password, name, role, groupId, birthDate } = input;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      groupId,
      birthDate,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      birthDate: true,
      createdAt: true,
    },
  });

  return user;
}

/**
 * Get user by ID (within group context for non-super admin)
 */
export async function getUserById(id: string, groupId?: string | null) {
  const where: { id: string; groupId?: string } = { id };
  if (groupId) {
    where.groupId = groupId;
  }

  return prisma.user.findFirst({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      birthDate: true,
      createdAt: true,
      updatedAt: true,
      group: {
        select: {
          id: true,
          name: true,
          domain: true,
        }
      }
    },
  });
}

/**
 * Get user by email (for login)
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          domain: true,
          isActive: true,
        },
      },
    },
  });
}

/**
 * Find user by email across all groups (same as getUserByEmail now)
 */
export async function findUserByEmailGlobal(email: string) {
  return getUserByEmail(email);
}

/**
 * List users in a group
 */
export async function listUsers(
  groupId: string | null,
  pagination: PaginationParams
): Promise<PaginatedResponse<unknown>> {
  const { page, pageSize } = pagination;
  const skip = (page - 1) * pageSize;

  const where = groupId ? { groupId } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        birthDate: true,
        createdAt: true,
        group: {
          select: {
            id: true,
            name: true,
          }
        }
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Update user
 */
export async function updateUser(id: string, groupId: string | null, input: UpdateUserInput) {
  const data: Record<string, unknown> = {};

  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.birthDate !== undefined) data.birthDate = input.birthDate;

  if (input.password !== undefined) {
    data.password = await bcrypt.hash(input.password, config.bcryptRounds);
  }

  // Build where clause
  const where: { id: string; groupId?: string } = { id };
  if (groupId) {
    where.groupId = groupId;
  }

  return prisma.user.update({
    where,
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      birthDate: true,
    },
  });
}

/**
 * Delete user
 */
export async function deleteUser(id: string, groupId: string | null) {
  const where: { id: string; groupId?: string } = { id };
  if (groupId) {
    where.groupId = groupId;
  }

  return prisma.user.delete({
    where,
  });
}

/**
 * Validate user password
 */
export async function validatePassword(user: { password: string }, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}

/**
 * Get super admin by email (unified - just finds SUPER_ADMIN role user)
 */
export async function getSuperAdminByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      role: 'SUPER_ADMIN',
    },
  });
}

/**
 * Create super admin (unified - creates user with SUPER_ADMIN role)
 */
export async function createSuperAdmin(email: string, password: string, name: string) {
  const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN',
      groupId: null, // Super admin has no group
      emailVerified: true, // Auto-verify super admin
    },
  });
}

// ============================================
// REGISTRATION & AUTH FUNCTIONS
// ============================================

/**
 * Generate a random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Register a new user (public registration)
 */
export async function registerUser(input: RegisterUserInput) {
  const { email, username, password, name, groupId, birthDate } = input;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

  // Generate email verification token (expires in 24 hours)
  const emailVerificationToken = generateToken();
  const emailVerificationExpires = new Date();
  emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username: username?.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'MEMBER', // Default role for self-registration
      groupId,
      birthDate,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
    },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      emailVerified: true,
      birthDate: true,
      createdAt: true,
    },
  });

  return { user, emailVerificationToken };
}

/**
 * Check if email is already registered
 */
export async function isEmailRegistered(email: string, groupId?: string): Promise<boolean> {
  // Email is now globally unique
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  return !!user;
}

/**
 * Check if username is already taken in a group
 */
export async function isUsernameTaken(username: string, groupId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      username: username.toLowerCase(),
      groupId,
    },
  });
  return !!user;
}

/**
 * Verify email using token
 */
export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: { gte: new Date() },
    },
  });

  if (!user) {
    return null;
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
    },
  });
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return null;
  }

  // Generate reset token (expires in 1 hour)
  const passwordResetToken = generateToken();
  const passwordResetExpires = new Date();
  passwordResetExpires.setHours(passwordResetExpires.getHours() + 1);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken,
      passwordResetExpires,
    },
  });

  return { user, passwordResetToken };
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gte: new Date() },
    },
  });

  if (!user) {
    return null;
  }

  const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);

  return prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}

/**
 * Find user by email or username (for login)
 */
export async function findUserByEmailOrUsername(identifier: string) {
  const lowerIdentifier = identifier.toLowerCase();

  return prisma.user.findFirst({
    where: {
      OR: [
        { email: lowerIdentifier },
        { username: lowerIdentifier },
      ],
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          domain: true,
          isActive: true,
        },
      },
    },
  });
}

/**
 * Link OAuth provider to user
 */
export async function linkOAuthProvider(
  userId: string,
  provider: 'google' | 'microsoft' | 'apple',
  providerId: string
) {
  const data: Record<string, string> = {};

  switch (provider) {
    case 'google':
      data.googleId = providerId;
      break;
    case 'microsoft':
      data.microsoftId = providerId;
      break;
    case 'apple':
      data.appleId = providerId;
      break;
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      googleId: true,
      microsoftId: true,
      appleId: true,
    },
  });
}

/**
 * Find user by OAuth provider ID
 */
export async function findUserByOAuthProvider(
  provider: 'google' | 'microsoft' | 'apple',
  providerId: string
) {
  const where: Record<string, string> = {};

  switch (provider) {
    case 'google':
      where.googleId = providerId;
      break;
    case 'microsoft':
      where.microsoftId = providerId;
      break;
    case 'apple':
      where.appleId = providerId;
      break;
  }

  return prisma.user.findFirst({
    where,
    include: {
      group: {
        select: {
          id: true,
          name: true,
          domain: true,
          isActive: true,
        },
      },
    },
  });
}

/**
 * Update last login info
 */
export async function updateLastLogin(userId: string, ipAddress?: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });
}
