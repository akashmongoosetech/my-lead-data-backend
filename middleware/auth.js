import User from '../models/User.js'
import { verifyAccessToken } from '../utils/tokens.js'

// Verifies Bearer access token, loads safe user, attaches req.user.
// Never trusts identity fields sent from the frontend.
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) {
      res.status(401)
      throw new Error('Authentication required')
    }
    let payload
    try {
      payload = verifyAccessToken(token)
    } catch {
      res.status(401)
      throw new Error('Session expired')
    }
    const user = await User.findById(payload.sub).lean()
    if (!user || !user.isActive) {
      res.status(401)
      throw new Error('Authentication required')
    }
    req.user = {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: user.mobile,
      username: user.username,
      role: user.role,
      profilePicture: user.profilePicture || '',
      isActive: user.isActive,
    }
    next()
  } catch (error) {
    next(error)
  }
}

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403)
      return next(new Error('Forbidden'))
    }
    next()
  }
