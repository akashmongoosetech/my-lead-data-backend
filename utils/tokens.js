import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const ACCESS_TTL = '15m'
const REFRESH_TTL_DAYS = 7

export const REFRESH_COOKIE = 'rt'

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  )
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user._id), v: 1 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET)
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET)
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function refreshCookieOptions() {
  const prod = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: prod,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  }
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/auth',
  })
}
