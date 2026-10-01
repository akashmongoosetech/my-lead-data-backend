import express from 'express'
import {
  changeMyPassword,
  createUser,
  getUserById,
  getUsers,
  updateMyProfile,
  updateUser,
  updateUserStatus,
} from '../controllers/userController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// All user management requires authentication; writes require ADMIN.
router.use(authenticate)

// Self-service routes (any authenticated user). Declared before /:id.
router.route('/me').patch(updateMyProfile)
router.route('/me/password').patch(changeMyPassword)

router.route('/').get(getUsers).post(authorize('ADMIN'), createUser)
router.route('/:id').get(getUserById).patch(authorize('ADMIN'), updateUser)
router.route('/:id/status').patch(authorize('ADMIN'), updateUserStatus)

export default router
