import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB from '../config/db.js'
import Lead from '../models/Lead.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SOURCE = 'dataset_3'

const LEAD_FIELDS = [
  'title',
  'categoryName',
  'address',
  'city',
  'postalCode',
  'website',
  'phone',
  'phoneUnformatted',
]

const clean = (v) => (v === null || v === undefined ? '' : String(v).trim())

async function main() {
  const jsonPath = path.join(__dirname, '..', 'JSON-DATA', 'dataset_3.json')
  const raw = await fs.readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('dataset_3.json must be a JSON array')
  }

  await connectDB()

  // Backfill guard for pre-sourceDataset records (no-op if none exist).
  // Never touches status or other fields.
  const backfilled = (
    await Lead.updateMany(
      { sourceDataset: { $exists: false } },
      { $set: { sourceDataset: 'dataset_1' } }
    )
  ).modifiedCount

  const ops = []
  let skippedEmpty = 0

  for (const rec of parsed) {
    const title = clean(rec?.title)
    if (!title) {
      skippedEmpty += 1
      continue
    }
    const doc = {}
    for (const f of LEAD_FIELDS) doc[f] = clean(rec?.[f])

    ops.push({
      updateOne: {
        filter: { title: doc.title, phoneUnformatted: doc.phoneUnformatted },
        update: { $setOnInsert: { ...doc, status: 'New', sourceDataset: SOURCE } },
        upsert: true,
      },
    })
  }

  let inserted = 0
  let matched = 0
  if (ops.length > 0) {
    const BATCH = 500
    for (let i = 0; i < ops.length; i += BATCH) {
      const res = await Lead.bulkWrite(ops.slice(i, i + BATCH), {
        ordered: false,
      })
      inserted += res.upsertedCount ?? 0
      matched += res.matchedCount ?? 0
    }
  }

  const [total, d1, d2, d3] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ sourceDataset: 'dataset_1' }),
    Lead.countDocuments({ sourceDataset: 'dataset_2' }),
    Lead.countDocuments({ sourceDataset: 'dataset_3' }),
  ])

  console.log(
    JSON.stringify(
      {
        totalInFile: parsed.length,
        processed: ops.length,
        inserted,
        skippedExisting: matched,
        skippedEmptyTitle: skippedEmpty,
        backfilledDataset1: backfilled,
        totalInDb: total,
        byDataset: { dataset_1: d1, dataset_2: d2, dataset_3: d3 },
      },
      null,
      2
    )
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(`Import failed: ${err.message}`)
  process.exit(1)
})
