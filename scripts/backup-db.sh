#!/bin/sh
# Nightly MongoDB Atlas backup -> local archive, pruned to the last 7 days.
# Wire this into the host crontab (see docs/DEPLOY.md). Runs a throwaway `mongo`
# image via Docker so the EC2 host doesn't need mongodump installed natively —
# it dumps straight from Atlas over the network, no local mongo container involved.
#
# Check Atlas's own Cloud Backup settings for your cluster tier first (Database →
# Backup in the Atlas dashboard) — on paid tiers it may already cover this. This
# script is a free/cheap second copy regardless, and the only option on the M0
# free tier, which does not include continuous cloud backups.
set -e

BACKUP_DIR="/opt/portal/backups"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/portal-db-$STAMP.archive.gz"

mkdir -p "$BACKUP_DIR"

docker run --rm mongo:7 mongodump --uri="$DATABASE_URL" --archive --gzip > "$FILE"
echo "Backup written to $FILE"

# Keep only the last 7 days locally.
find "$BACKUP_DIR" -name "portal-db-*.archive.gz" -mtime +7 -delete

# Optional: also push to S3 (reuses the same bucket/creds as document uploads).
# Uncomment once the AWS CLI is installed on the host and configured with a
# role/credentials scoped to this bucket.
# aws s3 cp "$FILE" "s3://${AWS_S3_BUCKET}/db-backups/$(basename "$FILE")"

# To restore: docker run --rm -i mongo:7 mongorestore --uri="$DATABASE_URL" --archive --gzip < "$FILE"
