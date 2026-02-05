import fs from 'fs'
import path from 'path'
import { cmacgmToNormalized } from '~/adapters/api/cmacgm.adapter'
import { maerskToNormalized } from '~/adapters/api/maersk.adapter'
import { mscToNormalized } from '~/adapters/api/msc.adapter'
import { mapParsedStatusToF1 } from '~/adapters/cannonical/toCanonical.adapter'

function loadExample(name: string) {
  const p = path.resolve(process.cwd(), 'examples', name)
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

async function run() {
  console.log('Manual adapter run — examples -> adapters')

  // MSC
  try {
    const msc = loadExample('msc.json')
    const norm = mscToNormalized(msc)
    const containers = norm.containers ?? []
    console.log('MSC -> normalized containers:', containers.length)
  } catch (err) {
    console.error('MSC adapter failed:', err)
  }

  // CMA CGM
  try {
    const cma = loadExample('cmagcm.json')
    const norm = cmacgmToNormalized(cma)
    const containers = norm.containers ?? []
    console.log('CMA CGM -> normalized containers:', containers.length)
  } catch (err) {
    console.error('CMA CGM adapter failed:', err)
  }

  // Maersk
  try {
    const maersk = loadExample('maersk.json')
    const norm = maerskToNormalized(maersk)
    const containers = norm.containers ?? []
    console.log('Maersk -> normalized containers:', containers.length)
  } catch (err) {
    console.error('Maersk adapter failed:', err)
  }

  // toCanonical: use maersk example as parsed payload for mapParsedStatusToF1
  try {
    const parsed = loadExample('maersk.json')
    const res = mapParsedStatusToF1(parsed, 'MNBU3094033', 'maersk')
    console.log('toCanonical result ok:', res.ok)
    if (!res.ok) console.error('toCanonical error:', res.error)
    else console.log('toCanonical containers:', res.shipment.containers.length)
  } catch (err) {
    console.error('toCanonical execution failed:', err)
  }
}

run().catch((e) => {
  console.error('Manual run fatal error:', e)
  process.exit(1)
})
