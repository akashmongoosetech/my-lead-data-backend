import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB from '../config/db.js'
import Lead from '../models/Lead.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  const jsonPath = path.join(__dirname, '..', 'JSON-DATA', 'dataset_1.json')
  const raw = await fs.readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('dataset_1.json must be a JSON array')
  }

  await connectDB()

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
        update: { $setOnInsert: { ...doc, status: 'New', sourceDataset: 'dataset_1' } },
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

  const total = await Lead.countDocuments()
  console.log(
    JSON.stringify(
      { totalInFile: parsed.length, processed: ops.length, inserted, skippedExisting: matched, skippedEmptyTitle: skippedEmpty, totalInDb: total },
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
