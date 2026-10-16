#!/bin/sh
set -e

echo "⏳ Syncing database schema..."
# Use the locally installed Prisma CLI (v5, pinned in package.json).
# Never use `npx prisma` — it downloads the latest CLI at runtime which may
# be an incompatible major version (e.g. Prisma 7 broke datasource url syntax).
# MongoDB has no SQL migrations — `db push` syncs collections/indexes to match
# schema.prisma directly and is the only schema-sync command the connector supports.
./node_modules/.bin/prisma db push --skip-generate --accept-data-loss

echo "🌱 Running database seed (idempotent — safe to re-run)..."
node dist/seed/seed.js

echo "✅ Database ready. Starting web server..."
exec "$@"
