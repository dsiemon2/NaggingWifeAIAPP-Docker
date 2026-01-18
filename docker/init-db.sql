-- ============================================
-- PostgreSQL Row-Level Security (RLS) Setup
-- NaggingWife AI - Multi-tenant Isolation
-- ============================================

-- Enable RLS on tenant-specific tables
-- Note: These policies will be applied after Prisma creates the tables

-- Create an application role for the app to use
-- The app will set the current group_id in the session before queries

-- Function to get current group ID from session variable
CREATE OR REPLACE FUNCTION current_group_id() RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_group_id', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('app.is_super_admin', true) = 'true';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES (Applied after Prisma migration)
-- ============================================

-- Note: These CREATE POLICY statements will fail if tables don't exist yet
-- They should be run after prisma db push creates the tables
-- We use DO blocks with exception handling for safety

DO $$
BEGIN
    -- Enable RLS on ImportantDate
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ImportantDate') THEN
        ALTER TABLE "ImportantDate" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS importantdate_tenant_isolation ON "ImportantDate";
        CREATE POLICY importantdate_tenant_isolation ON "ImportantDate"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ImportantDate RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on WishlistItem
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'WishlistItem') THEN
        ALTER TABLE "WishlistItem" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS wishlistitem_tenant_isolation ON "WishlistItem";
        CREATE POLICY wishlistitem_tenant_isolation ON "WishlistItem"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'WishlistItem RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on Chore
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Chore') THEN
        ALTER TABLE "Chore" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS chore_tenant_isolation ON "Chore";
        CREATE POLICY chore_tenant_isolation ON "Chore"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Chore RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on GiftOrder
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'GiftOrder') THEN
        ALTER TABLE "GiftOrder" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS giftorder_tenant_isolation ON "GiftOrder";
        CREATE POLICY giftorder_tenant_isolation ON "GiftOrder"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'GiftOrder RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on Session
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Session') THEN
        ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS session_tenant_isolation ON "Session";
        CREATE POLICY session_tenant_isolation ON "Session"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Session RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on Payment
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Payment') THEN
        ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS payment_tenant_isolation ON "Payment";
        CREATE POLICY payment_tenant_isolation ON "Payment"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Payment RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on AuditLog
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'AuditLog') THEN
        ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS auditlog_tenant_isolation ON "AuditLog";
        CREATE POLICY auditlog_tenant_isolation ON "AuditLog"
            USING (is_super_admin() OR "groupId" IS NULL OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'AuditLog RLS setup skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Enable RLS on User (users can only see users in their group)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'User') THEN
        ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS user_tenant_isolation ON "User";
        CREATE POLICY user_tenant_isolation ON "User"
            USING (is_super_admin() OR "groupId" = current_group_id());
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'User RLS setup skipped: %', SQLERRM;
END $$;

-- ============================================
-- HELPER FUNCTION FOR APPLICATION USE
-- ============================================

-- Function to set the current tenant context (call this at the start of each request)
CREATE OR REPLACE FUNCTION set_tenant_context(group_id TEXT, super_admin BOOLEAN DEFAULT FALSE) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_group_id', COALESCE(group_id, ''), false);
    PERFORM set_config('app.is_super_admin', CASE WHEN super_admin THEN 'true' ELSE 'false' END, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- These will be created by Prisma, but we add them here for completeness
-- CREATE INDEX IF NOT EXISTS idx_importantdate_groupid ON "ImportantDate"("groupId");
-- CREATE INDEX IF NOT EXISTS idx_wishlistitem_groupid ON "WishlistItem"("groupId");
-- CREATE INDEX IF NOT EXISTS idx_chore_groupid ON "Chore"("groupId");
-- CREATE INDEX IF NOT EXISTS idx_giftorder_groupid ON "GiftOrder"("groupId");
-- CREATE INDEX IF NOT EXISTS idx_session_groupid ON "Session"("groupId");
-- CREATE INDEX IF NOT EXISTS idx_payment_groupid ON "Payment"("groupId");
-- CREATE INDEX IF NOT EXISTS idx_auditlog_groupid ON "AuditLog"("groupId");

RAISE NOTICE 'NaggingWife AI PostgreSQL initialization complete';
