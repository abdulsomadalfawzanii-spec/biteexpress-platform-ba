/**
 * BiteExpress — Admin Account Seed Script
 *
 * Creates the first admin account securely from the command line.
 * Run once to bootstrap the admin user, then use
 *   POST /api/auth/admin/create  (requires existing admin JWT)
 * to create additional admin accounts through the API.
 *
 * Usage:
 *   node scripts/createAdmin.js --email admin@example.com --password "use-a-unique-password" --name "Admin"
 *
 * Or set environment variables:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 ADMIN_NAME="Admin" node scripts/createAdmin.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env before reading any process.env values. __dirname makes
// this independent of whether npm is invoked from backend/ or another shell.
const envPath = path.resolve(__dirname, '..', '.env');
const dotenvResult = dotenv.config({ path: envPath, quiet: true });
if (dotenvResult.error) {
  console.error('  Unable to load backend/.env. Check that the file is readable and valid.');
  process.exit(1);
}

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/* ── Parse CLI args ────────────────────────────────── */
const args = process.argv.slice(2);
const get  = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const ADMIN_NAME     = get('--name')     || process.env.ADMIN_NAME;
const ADMIN_EMAIL    = get('--email')    || process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = get('--password') || process.env.ADMIN_PASSWORD;

/* ── Validation ────────────────────────────────────── */
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('  backend/.env must contain non-empty ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD assignments (or pass --name, --email and --password).');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error('  Admin password must be at least 12 characters.');
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(ADMIN_EMAIL)) {
  console.error('  Invalid email address:', ADMIN_EMAIL);
  process.exit(1);
}

async function main() {
  /* ── Connect to MongoDB ──────────────────────────── */
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('  MONGO_URI is not set in .env');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(mongoUri);
  console.log('  MongoDB connected');

  /* ── Load User model ─────────────────────────────── */
  // Register models in the right order so references work
  require('../models/User');
  const User = mongoose.model('User');

  /* ── Check if admin already exists ──────────────── */
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`  Admin already exists: ${existing.email}`);
      console.log('    Use --email with a different address to create another admin.');
    } else {
      console.log(`   A non-admin account already uses ${ADMIN_EMAIL} (role: ${existing.role}).`);
      console.log('    Choose a different email address.');
    }
    await mongoose.disconnect();
    process.exit(0);
  }

  /* ── Create admin ────────────────────────────────── */
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await User.create({
    name:            ADMIN_NAME,
    email:           ADMIN_EMAIL.toLowerCase(),
    password:        hashedPassword,
    role:            'admin',
    accountStatus:   'active',
    isEmailVerified: true,
  });

  console.log('');
  console.log(' Admin account created successfully!');
  console.log('   ┌─────────────────────────────────────────┐');
  console.log(`   │  Name    : ${admin.name.padEnd(30)} │`);
  console.log(`   │  Email   : ${admin.email.padEnd(30)} │`);
  console.log(`   │  Role    : ${admin.role.padEnd(30)} │`);
  console.log(`   │  ID      : ${String(admin._id).padEnd(30)} │`);
  console.log('   └─────────────────────────────────────────┘');
  console.log('');
  console.log(`   Log in at: http://localhost:5173/admin/login`);
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('  Seed script failed:', err.message);
  process.exit(1);
});
