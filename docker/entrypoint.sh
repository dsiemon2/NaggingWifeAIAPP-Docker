#!/bin/sh
set -e

echo "Starting Nagging Wife AI..."

# Wait for PostgreSQL to be ready using a simple connection check
echo "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

# Extract host from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=5432

until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "ERROR: PostgreSQL not ready after $MAX_RETRIES attempts. Exiting."
        exit 1
    fi
    echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

# Give PostgreSQL a moment to accept connections
sleep 2
echo "PostgreSQL is ready!"

# Run database migrations
echo "Running database migrations..."
npx prisma db push --skip-generate

# Always run seed - Prisma upsert will handle duplicates
echo "Seeding database..."
npx prisma db seed || echo "Seed completed (or skipped if data exists)"

# Determine which server to start based on command
case "$1" in
    app)
        echo "Starting main app server on port 3000..."
        exec node dist/server.js
        ;;
    admin)
        echo "Starting admin server on port 3001..."
        exec node dist/adminServer.js
        ;;
    *)
        echo "Usage: entrypoint.sh {app|admin}"
        exit 1
        ;;
esac
