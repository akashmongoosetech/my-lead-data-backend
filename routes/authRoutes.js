import express from 'express'
import rateLimit from 'express-rate-limit'
import { login, logout, me, refresh } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
})

const router = express.Router()

router.post('/login', strictLimiter, login)
router.post('/refresh', strictLimiter, refresh)
router.post('/logout', logout)
router.get('/me', authenticate, me)

export default router
