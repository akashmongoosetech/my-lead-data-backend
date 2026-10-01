import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import connectDB from '../config/db.js'
import User from '../models/User.js'

dotenv.config()

// One-time bootstrap: creates the first ADMIN user from env vars.
// Safe to re-run — does nothing if an ADMIN already exists.
async function main() {
  const { ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMAIL, ADMIN_MOBILE, ADMIN_USERNAME, ADMIN_PASSWORD } =
    process.env

  for (const [key, val] of Object.entries({
    ADMIN_FIRST_NAME,
    ADMIN_LAST_NAME,
    ADMIN_EMAIL,
    ADMIN_MOBILE,
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
  })) {
    if (!val) throw new Error(`Missing required env var: ${key}`)
  }

  await connectDB()

  const existing = await User.findOne({ role: 'ADMIN' }).lean()
  if (existing) {
    console.log(`ADMIN already exists (${existing.username}). Nothing to do.`)
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash(String(ADMIN_PASSWORD), 12)
  const admin = await User.create({
    firstName: String(ADMIN_FIRST_NAME).trim(),
    lastName: String(ADMIN_LAST_NAME).trim(),
    email: String(ADMIN_EMAIL).trim().toLowerCase(),
    mobile: String(ADMIN_MOBILE).trim(),
    username: String(ADMIN_USERNAME).trim().toLowerCase(),
    passwordHash,
    role: 'ADMIN',
  })

  console.log(`ADMIN created: ${admin.username} (${admin.email})`)
  process.exit(0)
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`)
  process.exit(1)
})
