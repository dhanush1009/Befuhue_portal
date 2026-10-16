/**
 * Prisma Seed Script — idempotent, safe to run on every deploy.
 * Creates only the admin user and company settings.
 * No demo/dummy data.
 */

import { PrismaClient, Role } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── Admin user ──────────────────────────────────────────────────────────────
  // No default account and no default password: both must be supplied when the seed is run.
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName     = process.env.ADMIN_NAME ?? 'Admin';
  if (!adminEmail || !adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (a strong, unique password) before running the seed. No default account is created.');
  }
  if (adminPassword.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  const adminHash     = await bcryptjs.hash(adminPassword, 10);

  await prisma.user.upsert({
    where:  { email: adminEmail },
    update: {},
    create: {
      email:          adminEmail,
      name:           adminName,
      passwordHash:   adminHash,
      hashedPassword: adminHash,
      role:           Role.ADMIN,
      isActive:       true,
    },
  });
  console.log(`✅ Admin: ${adminEmail}`);

  // ── Company settings ────────────────────────────────────────────────────────
  await prisma.companySettings.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: {
      id:            'singleton',
      name:          process.env.COMPANY_NAME ?? 'My Company',
      logoUrl:       '/branding/logo-mark.png', // ships with the repo for the sidebar/header; upload via Settings to get an absolute S3 URL so it also renders inside generated payslip/report PDFs
      address:       process.env.COMPANY_ADDRESS ?? '', // set the registered office address before publishing payslips
      payslipFooter: process.env.COMPANY_NAME ?? '',
    },
  });
  console.log('✅ Company settings seeded');

  // ── System motivational quotes ────────────────────────────────────────────
  const systemQuotes = [
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
    { text: 'Coming together is a beginning, staying together is progress, and working together is success.', author: 'Henry Ford' },
    { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
    { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
    { text: 'Success is not the key to happiness. Happiness is the key to success.', author: 'Albert Schweitzer' },
    { text: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
    { text: "Hard work beats talent when talent doesn't work hard.", author: 'Tim Notke' },
    { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
    { text: "You don't have to be great to start, but you have to start to be great.", author: 'Zig Ziglar' },
    { text: 'Alone we can do so little; together we can do so much.', author: 'Helen Keller' },
    { text: 'Talent wins games, but teamwork and intelligence win championships.', author: 'Michael Jordan' },
    { text: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein' },
    { text: 'The harder I work, the luckier I get.', author: 'Gary Player' },
    { text: 'Success usually comes to those who are too busy to be looking for it.', author: 'Henry David Thoreau' },
    { text: "Opportunities don't happen. You create them.", author: 'Chris Grosser' },
    { text: 'If you are not willing to risk the usual, you will have to settle for the ordinary.', author: 'Jim Rohn' },
    { text: 'Do one thing every day that scares you.', author: 'Eleanor Roosevelt' },
    { text: 'What you lack in talent can be made up with desire, hustle, and giving 110% all the time.', author: 'Don Zimmer' },
    { text: 'Dream big. Start small. Act now.', author: null },
    { text: 'Push yourself, because no one else is going to do it for you.', author: null },
    { text: 'Great things never come from comfort zones.', author: null },
    { text: 'The difference between ordinary and extraordinary is that little extra.', author: null },
    { text: 'Work hard in silence. Let success make the noise.', author: null },
    { text: 'Build something today, even if it is small.', author: null },
    { text: 'Your limitation — it is only your imagination.', author: null },
    { text: 'Sometimes later becomes never. Do it now.', author: null },
    { text: 'Little things make big days.', author: null },
  ] as const;

  for (const quote of systemQuotes) {
    // Use first 30 chars of text as a stable lookup key via a raw upsert on text
    const existing = await prisma.quote.findFirst({
      where: { text: quote.text, isSystem: true },
    });
    if (!existing) {
      await prisma.quote.create({
        data: {
          text:     quote.text,
          author:   quote.author ?? null,
          isSystem: true,
          isActive: true,
        },
      });
    }
  }
  console.log('✅ System quotes seeded (30)');

  console.log('\n✅ Seed complete!\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
