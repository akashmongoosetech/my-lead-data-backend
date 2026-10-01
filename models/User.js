import mongoose from 'mongoose'

export const USER_ROLES = ['ADMIN', 'USER']

const PROFILE_URL_MAX = 2048

function isHttpUrl(v) {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, 'First name is required'], trim: true, maxlength: 50 },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true, maxlength: 50 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is invalid'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile is required'],
      unique: true,
      trim: true,
      maxlength: 20,
      match: [/^[+\d][\d\s-]{6,19}$/, 'Mobile number is invalid'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-z0-9._-]+$/, 'Username may contain letters, numbers, dot, underscore, hyphen'],
    },
    passwordHash: { type: String, required: true, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
    profilePicture: {
      type: String,
      default: '',
      trim: true,
      maxlength: PROFILE_URL_MAX,
      validate: {
        validator: (v) => !v || (v.length <= PROFILE_URL_MAX && isHttpUrl(v)),
        message: 'Profile picture must be a valid http(s) URL',
      },
    },
    role: { type: String, enum: USER_ROLES, default: 'USER' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// NOTE: email/mobile/username unique indexes come from `unique: true` above.

const User = mongoose.model('User', userSchema)

export default User
