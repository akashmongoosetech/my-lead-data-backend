import Lead, { DATASETS, LEAD_STATUSES } from '../models/Lead.js'

const SEARCH_FIELDS = [
  'title',
  'categoryName',
  'address',
  'city',
  'postalCode',
  'phone',
  'phoneUnformatted',
]

const ALLOWED_SORTS = new Set([
  'createdAt',
  '-createdAt',
  'title',
  '-title',
  'city',
  '-city',
  'categoryName',
  '-categoryName',
  'updatedAt',
  '-updatedAt',
])

// GET /api/leads?page=1&limit=20&search=&status=&category=&city=&sourceDataset=&sort=-createdAt
export const getLeads = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const { search = '', status = '', category = '', city = '', sourceDataset = '' } = req.query
    let { sort = '-createdAt' } = req.query
    if (!ALLOWED_SORTS.has(sort)) sort = '-createdAt'

    const filter = {}
    if (status) {
      if (!LEAD_STATUSES.includes(status)) {
        res.status(400)
        throw new Error(`Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}`)
      }
      filter.status = status
    }
    if (sourceDataset) {
      if (!DATASETS.includes(sourceDataset)) {
        res.status(400)
        throw new Error(`Invalid sourceDataset. Allowed: ${DATASETS.join(', ')}`)
      }
      filter.sourceDataset = sourceDataset
    }
    if (category) filter.categoryName = category
    if (city) filter.city = city
    if (search && String(search).trim()) {
      const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = SEARCH_FIELDS.map((f) => ({ [f]: rx }))
    }

    const total = await Lead.countDocuments(filter)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const leads = await Lead.find(filter)
      .select('-__v')
      .sort(sort)
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: leads,
      pagination: { page: safePage, limit, total, totalPages },
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/leads/:id
export const getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id).select('-__v').lean()
    if (!lead) {
      res.status(404)
      throw new Error('Lead not found')
    }
    res.json({ success: true, data: lead })
  } catch (error) {
    next(error)
  }
}

// PATCH /api/leads/:id/status  { status }
export const updateLeadStatus = async (req, res, next) => {
  try {
    const { status } = req.body ?? {}
    if (!LEAD_STATUSES.includes(status)) {
      res.status(400)
      throw new Error(`Invalid status. Allowed: ${LEAD_STATUSES.join(', ')}`)
    }
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-__v').lean()
    if (!lead) {
      res.status(404)
      throw new Error('Lead not found')
    }
    res.json({ success: true, data: lead })
  } catch (error) {
    next(error)
  }
}

// GET /api/leads/meta/categories
export const getLeadCategories = async (req, res, next) => {
  try {
    const categories = await Lead.distinct('categoryName')
    res.json({ success: true, data: categories.filter(Boolean).sort() })
  } catch (error) {
    next(error)
  }
}

// GET /api/leads/stats
export const getLeadStats = async (req, res, next) => {
  try {
    const [total, byStatus, byDataset] = await Promise.all([
      Lead.countDocuments(),
      Lead.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $group: { _id: '$sourceDataset', count: { $sum: 1 } } },
      ]),
    ])
    const counts = {}
    for (const s of LEAD_STATUSES) counts[s] = 0
    for (const row of byStatus) {
      if (row._id) counts[row._id] = row.count
    }
    const datasets = { dataset_1: 0, dataset_2: 0 }
    for (const row of byDataset) {
      if (row._id) datasets[row._id] = row.count
    }
    res.json({ success: true, data: { total, byStatus: counts, byDataset: datasets } })
  } catch (error) {
    next(error)
  }
}

// GET /api/leads/meta/cities
export const getLeadCities = async (req, res, next) => {
  try {
    const rows = await Lead.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$city', ''] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    res.json({
      success: true,
      data: rows.map((r) => ({ city: r._id ?? '', count: r.count })),
    })
  } catch (error) {
    next(error)
  }
}
