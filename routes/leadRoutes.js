import express from 'express'
import {
  getLeadById,
  getLeadCategories,
  getLeadCities,
  getLeadStats,
  getLeads,
  updateLeadStatus,
} from '../controllers/leadController.js'

const router = express.Router()

router.get('/stats', getLeadStats)
router.get('/meta/categories', getLeadCategories)
router.get('/meta/cities', getLeadCities)
router.get('/', getLeads)
router.get('/:id', getLeadById)
router.patch('/:id/status', updateLeadStatus)

export default router
