import fs from 'fs'
import path from 'path'
import { cmacgmToNormalized } from '~/adapters/cmacgm.adapter'
import { maerskToNormalized } from '~/adapters/maersk.adapter'
import { mscToNormalized } from '~/adapters/msc.adapter'

function loadJson(name: string) {
  const p = path.join(process.cwd(), 'examples', name)
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw)
}

function print(title: string, obj: unknown) {
  console.log('---', title, '---')
  console.log(JSON.stringify(obj, null, 2))
}

function main() {
  try {
    const maersk = loadJson('maersk.json')
    const normalizedM = maerskToNormalized(maersk)
    print('Maersk Normalized', normalizedM)
  } catch (err) {
    console.error('Maersk error', err)
  }

  try {
    const cma = loadJson('cmagcm.json')
    const normalizedC = cmacgmToNormalized(cma)
    print('CMA CGM Normalized', normalizedC)
  } catch (err) {
    console.error('CMA CGM error', err)
  }

  try {
    const msc = loadJson('msc.json')
    const normalizedS = mscToNormalized(msc)
    print('MSC Normalized', normalizedS)
  } catch (err) {
    console.error('MSC error', err)
  }
}

main()
