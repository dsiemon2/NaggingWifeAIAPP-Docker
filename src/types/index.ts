import { Request } from 'express';

// Role types - matches Prisma UserRole enum
export type Role = 'SUPER_ADMIN' | 'GROUP_ADMIN' | 'PARTNER' | 'MEMBER';

// JWT Payload for all users (unified)
export interface JwtPayload {
  userId: string;
  email: string;
  groupId: string | null; // Null for SUPER_ADMIN
  role: Role;
  name: string;
  birthDate?: string | null; // ISO date string for age verification
}

// Backwards compatibility alias
export type SuperAdminJwtPayload = JwtPayload;

// OAuth user data that might need company assignment
export interface OAuthPendingUser {
  profile: unknown;
  email: string;
  needsCompany: true;
}

// Full user from database
export interface AuthenticatedUser {
  id: string;
  email: string;
  groupId: string;
  role: string;
  group?: {
    id: string;
    name: string;
    domain: string;
    isActive: boolean;
  };
}

// Augment Express types to include our custom user type
declare global {
  namespace Express {
    // User matches JwtPayload for authenticated requests
    interface User extends JwtPayload {}
  }
}

// Assistant modes for NaggingWife AI
export type AssistantMode = 'helpful' | 'firm' | 'gentle' | 'nagging';

// Session status for reminder check-ins
export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'MISSED';

// Satisfaction rating for completed reminders/tasks
export type SatisfactionRating = 'VERY_HAPPY' | 'HAPPY' | 'NEUTRAL' | 'UNHAPPY' | 'VERY_UNHAPPY';

// Extended Express Request with auth info
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  superAdmin?: JwtPayload; // Backwards compatibility
  groupId?: string | null;
}

// Helper type to check if user is 18+
export function isAdult(birthDate: string | null | undefined): boolean {
  if (!birthDate) return true; // Assume adult if no birthdate provided
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

// Reminder with follow-up actions
export interface ReminderWithActions {
  id: string;
  text: string;
  followUpActions: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: Date | null;
  isCompleted: boolean;
  category: 'chores' | 'dates' | 'gifts' | 'general';
}

// Family task summary
export interface FamilyTaskSummary {
  categories: {
    [categoryName: string]: {
      completedCount: number;
      pendingCount: number;
      overdueCount: number;
      tasks: {
        taskId: string;
        taskName: string;
        status: string;
        dueDate: Date | null;
        notes: string;
      }[];
    };
  };
  overallCompletionRate: number;
  upcomingDates: string[];
  overdueItems: string[];
  satisfactionRating: SatisfactionRating;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
