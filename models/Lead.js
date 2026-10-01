import mongoose from 'mongoose'

export const LEAD_STATUSES = [
  'New',
  'Message',
  'Whatsapp',
  'Call',
  'Follow Up',
  'Convert',
  'Working',
  'Complete',
]

export const DATASETS = ['dataset_1', 'dataset_2']

const leadSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    categoryName: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    postalCode: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    phoneUnformatted: { type: String, default: '', trim: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'New' },
    sourceDataset: {
      type: String,
      enum: DATASETS,
      default: 'dataset_1',
    },
  },
  { timestamps: true }
)

leadSchema.index({ title: 1, phoneUnformatted: 1 }, { unique: true })
leadSchema.index({ sourceDataset: 1 })
leadSchema.index({ city: 1 })
leadSchema.index({ status: 1 })
leadSchema.index({ categoryName: 1 })

const Lead = mongoose.model('Lead', leadSchema)

export default Lead
