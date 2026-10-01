import bcrypt from 'bcryptjs'
import User, { USER_ROLES } from '../models/User.js'

const BCRYPT_ROUNDS = 12

function safeUser(u) {
  const o = u.toObject ? u.toObject() : u
  return {
    id: String(o._id),
    firstName: o.firstName,
    lastName: o.lastName,
    email: o.email,
    mobile: o.mobile,
    username: o.username,
    profilePicture: o.profilePicture || '',
    role: o.role,
    isActive: o.isActive,
    lastLoginAt: o.lastLoginAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

function clean(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128) {
    return 'Password must be 8–128 characters.'
  }
  return null
}

function isHttpUrl(v) {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function duplicateMessage(err) {
  const key = Object.keys(err.keyValue || {})[0] || ''
  if (key === 'username') return 'Username already exists.'
  if (key === 'email') return 'Email already registered.'
  if (key === 'mobile') return 'Mobile number already registered.'
  return 'User already exists.'
}

// GET /api/users?page=1&limit=20&search=&isActive=
export const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const { search = '', isActive = '' } = req.query
    const filter = {}
    if (isActive === 'true') filter.isActive = true
    if (isActive === 'false') filter.isActive = false
    if (search && String(search).trim()) {
      const rx = new RegExp(
        String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      )
      filter.$or = [
        { firstName: rx },
        { lastName: rx },
        { email: rx },
        { mobile: rx },
        { username: rx },
      ]
    }
    const total = await User.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const users = await User.find(filter)
      .select('-passwordHash -refreshTokenHash -__v')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean()
    res.json({
      success: true,
      data: users.map((u) => ({ ...u, id: String(u._id) })),
      pagination: { page: safePage, limit, total, totalPages },
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -refreshTokenHash -__v')
      .lean()
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    res.json({ success: true, data: { ...user, id: String(user._id) } })
  } catch (error) {
    next(error)
  }
}

// POST /api/users  (ADMIN only — enforced in routes)
export const createUser = async (req, res, next) => {
  try {
    const firstName = clean(req.body?.firstName)
    const lastName = clean(req.body?.lastName)
    const email = clean(req.body?.email).toLowerCase()
    const mobile = clean(req.body?.mobile)
    const username = clean(req.body?.username).toLowerCase()
    const { password, confirmPassword } = req.body ?? {}
    const profilePicture = clean(req.body?.profilePicture)
    const role = req.body?.role === 'ADMIN' ? 'ADMIN' : 'USER'

    if (!firstName || !lastName || !email || !mobile || !username) {
      res.status(400)
      throw new Error('First name, last name, email, mobile and username are required.')
    }
    if (!USER_ROLES.includes(role)) {
      res.status(400)
      throw new Error('Invalid role.')
    }
    const pwError = validatePassword(password)
    if (pwError) {
      res.status(400)
      throw new Error(pwError)
    }
    if (password !== confirmPassword) {
      res.status(400)
      throw new Error('Passwords do not match.')
    }
    if (profilePicture && (profilePicture.length > 2048 || !isHttpUrl(profilePicture))) {
      res.status(400)
      throw new Error('Profile picture must be a valid http(s) URL.')
    }

    try {
      const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS)
      const user = await User.create({
        firstName,
        lastName,
        email,
        mobile,
        username,
        passwordHash,
        profilePicture,
        role,
      })
      res.status(201).json({ success: true, data: safeUser(user) })
    } catch (err) {
      if (err?.code === 11000) {
        res.status(409)
        throw new Error(duplicateMessage(err))
      }
      throw err
    }
  } catch (error) {
    next(error)
  }
}

// PATCH /api/users/me  (self-service: any authenticated user)
// Allows firstName, lastName, email, mobile, username, profilePicture.
// role / isActive / password are silently ignored here.
export const updateMyProfile = async (req, res, next) => {
  try {
    const update = {}
    for (const f of ['firstName', 'lastName', 'profilePicture']) {
      if (req.body?.[f] !== undefined) update[f] = clean(req.body[f])
    }
    if (req.body?.email !== undefined) update.email = clean(req.body.email).toLowerCase()
    if (req.body?.mobile !== undefined) update.mobile = clean(req.body.mobile)
    if (req.body?.username !== undefined) update.username = clean(req.body.username).toLowerCase()

    if (update.firstName !== undefined && !update.firstName) {
      res.status(400)
      throw new Error('First name cannot be empty.')
    }
    if (update.lastName !== undefined && !update.lastName) {
      res.status(400)
      throw new Error('Last name cannot be empty.')
    }
    if (
      update.profilePicture &&
      (update.profilePicture.length > 2048 || !isHttpUrl(update.profilePicture))
    ) {
      res.status(400)
      throw new Error('Profile picture must be a valid http(s) URL.')
    }

    try {
      const user = await User.findByIdAndUpdate(req.user.id, update, {
        new: true,
        runValidators: true,
      }).select('-passwordHash -refreshTokenHash -__v')
      if (!user) {
        res.status(404)
        throw new Error('User not found')
      }
      res.json({ success: true, data: safeUser(user) })
    } catch (err) {
      if (err?.code === 11000) {
        res.status(409)
        throw new Error(duplicateMessage(err))
      }
      throw err
    }
  } catch (error) {
    next(error)
  }
}

// PATCH /api/users/me/password  (self-service: any authenticated user)
// { currentPassword, newPassword, confirmPassword }. Rotates sessions.
export const changeMyPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {}
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400)
      throw new Error('Current password, new password and confirmation are required.')
    }
    const user = await User.findById(req.user.id).select('+passwordHash')
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    const ok = await bcrypt.compare(String(currentPassword), user.passwordHash)
    if (!ok) {
      res.status(401)
      throw new Error('Current password is incorrect.')
    }
    const pwError = validatePassword(newPassword)
    if (pwError) {
      res.status(400)
      throw new Error(pwError)
    }
    if (newPassword !== confirmPassword) {
      res.status(400)
      throw new Error('Passwords do not match.')
    }
    user.passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS)
    user.refreshTokenHash = null // log out other sessions
    await user.save()
    res.json({ success: true, message: 'Password updated. Please log in again on other devices.' })
  } catch (error) {
    next(error)
  }
}

// PATCH /api/users/:id  (ADMIN only — basic fields, never password/role escalation unchecked)
export const updateUser = async (req, res, next) => {
  try {
    const allowed = ['firstName', 'lastName', 'profilePicture']
    const update = {}
    for (const f of allowed) {
      if (req.body?.[f] !== undefined) update[f] = clean(req.body[f])
    }
    if (update.profilePicture && (update.profilePicture.length > 2048 || !isHttpUrl(update.profilePicture))) {
      res.status(400)
      throw new Error('Profile picture must be a valid http(s) URL.')
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select('-passwordHash -refreshTokenHash -__v')
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    res.json({ success: true, data: safeUser(user) })
  } catch (error) {
    next(error)
  }
}

// PATCH /api/users/:id/status  { isActive: boolean }  (ADMIN only)
export const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body ?? {}
    if (typeof isActive !== 'boolean') {
      res.status(400)
      throw new Error('isActive must be true or false.')
    }
    if (String(req.params.id) === String(req.user.id) && !isActive) {
      res.status(400)
      throw new Error('You cannot deactivate your own account.')
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive, ...(isActive === false ? { refreshTokenHash: null } : {}) },
      { new: true, runValidators: true }
    ).select('-passwordHash -refreshTokenHash -__v')
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    res.json({ success: true, data: safeUser(user) })
  } catch (error) {
    next(error)
  }
}
