import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  hashToken,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js'

const GENERIC_LOGIN_ERROR = 'Invalid username, email/mobile number, or password.'

function safeUser(u) {
  return {
    id: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    mobile: u.mobile,
    username: u.username,
    profilePicture: u.profilePicture || '',
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
  }
}

function normalizeIdentifier(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return ''
  return v.length > 254 ? '' : v
}

// POST /api/auth/login  { identifier, password }
export const login = async (req, res, next) => {
  try {
    const identifier = normalizeIdentifier(req.body?.identifier)
    const { password } = req.body ?? {}
    if (!identifier || !password) {
      res.status(400)
      throw new Error('Identifier and password are required.')
    }

    const lowered = identifier.toLowerCase()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
    const query = isEmail
      ? { email: lowered }
      : { $or: [{ username: lowered }, { mobile: identifier }] }

    const user = await User.findOne(query).select('+passwordHash')
    if (!user || !user.isActive) {
      res.status(401)
      throw new Error(GENERIC_LOGIN_ERROR)
    }
    const ok = await bcrypt.compare(String(password), user.passwordHash)
    if (!ok) {
      res.status(401)
      throw new Error(GENERIC_LOGIN_ERROR)
    }

    const accessToken = signAccessToken(user)
    const refreshToken = signRefreshToken(user)
    user.refreshTokenHash = hashToken(refreshToken)
    user.lastLoginAt = new Date()
    await user.save()

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions())
    res.json({ success: true, accessToken, user: safeUser(user) })
  } catch (error) {
    next(error)
  }
}

// POST /api/auth/refresh  (refresh token via HttpOnly cookie)
export const refresh = async (req, res, next) => {
  try {
    const origin = req.headers.origin
    const allowed = (process.env.FRONTEND_URL || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (origin && allowed.length > 0 && !allowed.includes(origin)) {
      res.status(403)
      throw new Error('Forbidden')
    }
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) {
      res.status(401)
      throw new Error('Session expired')
    }
    let payload
    try {
      payload = verifyRefreshToken(token)
    } catch {
      res.status(401)
      throw new Error('Session expired')
    }
    const user = await User.findById(payload.sub).select('+refreshTokenHash')
    if (!user || !user.isActive || user.refreshTokenHash !== hashToken(token)) {
      res.status(401)
      throw new Error('Session expired')
    }

    const accessToken = signAccessToken(user)
    const nextRefresh = signRefreshToken(user)
    user.refreshTokenHash = hashToken(nextRefresh)
    await user.save()

    res.cookie(REFRESH_COOKIE, nextRefresh, refreshCookieOptions())
    res.json({ success: true, accessToken, user: safeUser(user) })
  } catch (error) {
    next(error)
  }
}

// POST /api/auth/logout
export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (token) {
      try {
        const payload = verifyRefreshToken(token)
        await User.findByIdAndUpdate(payload.sub, { refreshTokenHash: null })
      } catch {
        // Token already invalid — still clear the cookie below.
      }
    }
    clearRefreshCookie(res)
    res.json({ success: true, message: 'Logged out' })
  } catch (error) {
    next(error)
  }
}

// GET /api/auth/me
export const me = async (req, res) => {
  res.json({ success: true, user: req.user })
}
