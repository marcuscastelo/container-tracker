// @ts-nocheck
/// <reference types="vitest" />
import fs from 'fs'
import path from 'path'
import { it } from 'vitest'
import { cmacgmToNormalized } from '~/adapters/api/cmacgm.adapter'
import { maerskToNormalized } from '~/adapters/api/maersk.adapter'
import { mscToNormalized } from '~/adapters/api/msc.adapter'
import { mapParsedStatusToF1 } from '~/adapters/cannonical/toCanonical.adapter'

function loadExample(name: string) {
  const p = path.resolve(process.cwd(), 'examples', name)
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

it('manual adapters run (logs)', async () => {
  console.log('Manual adapter run — examples -> adapters')

  // MSC
  try {
    const msc = loadExample('msc.json')
    const norm = mscToNormalized(msc)
    console.log('MSC -> normalized containers:', norm.containers.length)
    // write output
    const outDir = path.resolve(process.cwd(), '.output')
    fs.mkdirSync(outDir, { recursive: true })
    const serialize = (v: unknown) =>
      JSON.stringify(v, (_k, val) => (val instanceof Date ? val.toISOString() : val), 2)
    fs.writeFileSync(path.join(outDir, 'msc.normalized.json'), serialize(norm))
  } catch (err) {
    console.error('MSC adapter failed:', err)
  }

  // CMA CGM
  try {
    const cma = loadExample('cmagcm.json')
    const norm = cmacgmToNormalized(cma)
    console.log('CMA CGM -> normalized containers:', norm.containers.length)
    const outDir = path.resolve(process.cwd(), '.output')
    fs.mkdirSync(outDir, { recursive: true })
    const serialize = (v: unknown) =>
      JSON.stringify(v, (_k, val) => (val instanceof Date ? val.toISOString() : val), 2)
    fs.writeFileSync(path.join(outDir, 'cmacgm.normalized.json'), serialize(norm))
  } catch (err) {
    console.error('CMA CGM adapter failed:', err)
  }

  // Maersk
  try {
    const maersk = loadExample('maersk.json')
    const norm = maerskToNormalized(maersk)
    console.log('Maersk -> normalized containers:', norm.containers.length)
    const outDir = path.resolve(process.cwd(), '.output')
    fs.mkdirSync(outDir, { recursive: true })
    const serialize = (v: unknown) =>
      JSON.stringify(v, (_k, val) => (val instanceof Date ? val.toISOString() : val), 2)
    fs.writeFileSync(path.join(outDir, 'maersk.normalized.json'), serialize(norm))
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
    const outDir = path.resolve(process.cwd(), '.output')
    fs.mkdirSync(outDir, { recursive: true })
    const serialize = (v: unknown) =>
      JSON.stringify(v, (_k, val) => (val instanceof Date ? val.toISOString() : val), 2)
    if (res.ok)
      fs.writeFileSync(path.join(outDir, 'toCanonical.maersk.json'), serialize(res.shipment))
    else
      fs.writeFileSync(
        path.join(outDir, 'toCanonical.maersk.error.json'),
        serialize({ error: res.error }),
      )
  } catch (err) {
    console.error('toCanonical execution failed:', err)
  }
})
