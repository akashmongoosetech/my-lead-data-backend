import User from '../models/User.js'

// GET /api/users
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 })
    res.json(users)
  } catch (error) {
    next(error)
  }
}

// GET /api/users/:id
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    res.json(user)
  } catch (error) {
    next(error)
  }
}

// POST /api/users
export const createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body
    if (!name || !email) {
      res.status(400)
      throw new Error('Name and email are required')
    }
    const user = await User.create({ name, email })
    res.status(201).json(user)
  } catch (error) {
    next(error)
  }
}

// PUT /api/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    res.json(user)
  } catch (error) {
    next(error)
  }
}

// DELETE /api/users/:id
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) {
      res.status(404)
      throw new Error('User not found')
    }
    res.json({ message: 'User removed' })
  } catch (error) {
    next(error)
  }
}
