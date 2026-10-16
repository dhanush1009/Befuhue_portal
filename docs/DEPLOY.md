# Deploying to AWS EC2

This app already ships with everything the deploy needs: a multi-stage [Dockerfile](../Dockerfile)
that builds a ~200MB standalone image, and [docker-compose.prod.yml](../docker-compose.prod.yml)
that runs the app + Caddy (auto-HTTPS) together. There is no CI/CD — every deploy is a manual
`docker build` + `docker push` + `docker compose pull && up -d`, by design (see steps 4 and 7).

**Database**: MongoDB Atlas (managed, cloud-hosted) — not self-hosted on the EC2 box. Atlas already
runs as a replica set (required for this app's Prisma `$transaction()` calls) and handles its own
backups, so the instance just needs outbound network access to reach it.

## 0. Before you start

- A GitHub repo you own (**not** the original `dhinesh-mohan/TechPortal` remote this project
  was cloned from — check with `git remote -v` and repoint it with
  `git remote set-url origin https://github.com/<you>/<repo>.git` if it's still pointing there).
- `portal.your-domain.example` — you control DNS for `your-domain.example`.
- A MongoDB Atlas cluster and its connection string (Database → Connect → Drivers in the Atlas
  dashboard). If this is a new cluster, also create a database user under Database Access.
- Every secret in `.env`/`.env.prod.example` is a placeholder. Generate fresh ones for this deploy
  (`openssl rand -base64 32` for `AUTH_SECRET` and `CRON_SECRET`).

## 1. Launch the EC2 instance

- **AMI**: Ubuntu 22.04 LTS (or Amazon Linux 2023 — commands below assume Ubuntu/apt).
- **Instance type**: `t3.micro` fits the AWS Free Tier (750 hrs/month for 12 months) and is comfortable
  here — the host only runs the app + Caddy in Docker, no build step and no database to host.
- **Storage**: 15–20GB gp3 EBS is plenty (no database data directory on this box, just Docker images and logs).
- **Security group**: allow inbound `22` (SSH, restrict to your IP if possible), `80`, `443`. Nothing else.
- **Key pair**: create/download one, you'll need it for SSH.
- Allocate an **Elastic IP** and associate it with the instance, so the IP survives a reboot/stop.
- **Atlas Network Access**: add the Elastic IP (as `<ip>/32`) to your Atlas cluster's IP Access List
  (Security → Network Access) — Atlas rejects connections from IPs it doesn't recognize, so the app
  can't reach the database until this is done.

## 2. Point DNS

In whatever DNS provider hosts `your-domain.example`, add:

```
A    portal.your-domain.example    →  <your Elastic IP>
```

Give it a few minutes to propagate before step 6 (Caddy needs it resolvable to issue a cert).

## 3. Install Docker on the instance

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out/in
docker compose version   # confirm the compose plugin is present
```

## 4. Build and push the image

No CI here — build it yourself (on your own machine, wherever you have Docker) and push to a
registry the EC2 host can pull from. GitHub Container Registry works without any extra account setup
since it reuses your GitHub login:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-username> --password-stdin
docker build -t ghcr.io/<your-github-username>/<your-repo-name>:latest .
docker push ghcr.io/<your-github-username>/<your-repo-name>:latest
```

`$GITHUB_TOKEN` here is a Personal Access Token with `write:packages` scope (Settings → Developer
settings → Personal access tokens). After the first push, go to your GitHub profile → **Packages** →
the new package → **Package settings → Change visibility → Public** — the image contains no secrets
(`.env` is explicitly excluded from the build, see the Dockerfile), so making it public means the EC2
host can `docker pull` without authenticating. (Keep it private instead if you'd rather run
`docker login ghcr.io` on the server too, with a PAT that has `read:packages`.)

Any registry works the same way — Docker Hub, ECR, etc. — just adjust the image tag and login step.

## 5. Copy deploy files to the server

You only need three files on the server — not the whole repo:

```bash
# from your machine
scp -i your-key.pem docker-compose.prod.yml Caddyfile .env.prod.example ubuntu@<elastic-ip>:~/
```

```bash
# on the server
mkdir -p ~/portal && mv docker-compose.prod.yml Caddyfile .env.prod.example ~/portal/
cd ~/portal
cp .env.prod.example .env
nano .env   # fill in every value — see checklist below
```

**`.env` checklist** (all placeholders in `.env.prod.example` right now):
- `DATABASE_URL` — your real Atlas connection string (user, password, cluster host, `appName`)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `CRON_SECRET` — `openssl rand -base64 32`
- `AUTH_URL` / `NEXTAUTH_URL` — `https://portal.your-domain.example`
- `SMTP_*` — see the email note below
- `AWS_*` — an S3 bucket + an IAM user scoped only to that bucket (for document/avatar/payslip uploads)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the first admin login, seeded automatically on first boot

Also set which image to pull (the compose file defaults to a placeholder name):
```bash
echo "DOCKER_IMAGE=ghcr.io/<your-github-username>/<your-repo-name>" >> .env
echo "IMAGE_TAG=latest" >> .env
```

## 6. Start it

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f web   # watch it come up
```

The container's entrypoint ([scripts/migrate-and-seed.sh](../scripts/migrate-and-seed.sh)) runs
`prisma db push` (MongoDB has no SQL migrations — this is the only schema-sync command the connector
supports) and the idempotent seed automatically on every start. Note that `db push` applies whatever
`schema.prisma` says with `--accept-data-loss` — unlike a reviewed SQL migration file, a field or index
you remove from the schema is dropped from the live database on the next deploy with no confirmation
step. Review schema changes carefully before pushing to `main`.

Caddy requests a Let's Encrypt cert for `portal.your-domain.example` automatically the first
time it sees a request, using the DNS record from step 2.

Visit `https://portal.your-domain.example` and log in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`. **Change
that password immediately** via the app's change-password flow.

## 7. Redeploying after a code change

Repeat the build/push from step 4, then on the server:

```bash
cd ~/portal
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Fully manual, on purpose — no GitHub Actions workflow, no SSH secrets sitting in CI. For a small
internal tool, a deliberate build-and-deploy you run yourself is a reasonable tradeoff against
maintaining automation for it.

## 8. Cron jobs

Three endpoints (`close-sessions`, `credit-earned-leave`, `due-reminders`) need something to call
them on a schedule, protected by `CRON_SECRET`. On the EC2 host:

```bash
crontab -e
```
```cron
# Auto-close attendance sessions left open past midnight
0 0 * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://portal.your-domain.example/api/cron/close-sessions
# Credit 1 earned leave on the 1st of every month
5 0 1 * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://portal.your-domain.example/api/cron/credit-earned-leave
# Send due-date reminders
0 9 * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://portal.your-domain.example/api/cron/due-reminders
```
`crontab -e` doesn't inherit shell variables, so either hardcode the actual secret value in place of
`$CRON_SECRET` above, or `source ~/portal/.env` at the top of a wrapper script.

## 9. Backups

First, check **Database → Backup** in the Atlas dashboard for your cluster's tier — paid tiers (M10+)
include continuous cloud backups, which may already cover this. The M0 free tier does not, so treat
this step as required if you're on it.

[scripts/backup-db.sh](../scripts/backup-db.sh) dumps the Atlas database via a throwaway `mongo`
Docker image (no mongodump install needed on the host) and prunes anything older than 7 days locally.
Copy it to the server and cron it nightly:

```bash
scp -i your-key.pem scripts/backup-db.sh ubuntu@<elastic-ip>:~/portal/
```
```cron
0 2 * * * cd ~/portal && . ./.env && sh backup-db.sh
```
This holds payroll and PAN/Aadhaar data — do not skip this step. Uncomment the S3 line in the script
once you're comfortable running `aws configure` on the box, so backups survive the instance itself
being lost.

## 10. Email deliverability

`.env.prod.example` ships with raw Gmail SMTP, which has low sending limits and often lands in spam.
Since `resend` is already a dependency, sign up at resend.com, verify `your-domain.example` (SPF/DKIM/DMARC
records they give you), and swap the `SMTP_*` block for Resend's SMTP credentials — no code change needed.

## Ongoing costs on the Free Tier / $100 credit

- `t3.micro` + 15-20GB gp3 EBS + Elastic IP: within Free Tier, effectively $0 for 12 months (an
  unattached Elastic IP does cost a small hourly fee if the instance is ever stopped — keep it running).
- Data transfer, S3 storage, and any instance upgrade come out of the $100 credit.
- Nothing here needs a load balancer, NAT gateway, or RDS — those are the line items that quietly
  burn credit fastest, and this stack doesn't need any of them for an internal team-sized tool.
