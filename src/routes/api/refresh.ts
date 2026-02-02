import fs from 'fs'
import path from 'path'

// Simple helper to recursively walk a directory
function walk(dir: string): string[] {
  const out: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function parseCurl(content: string) {
  // url
  const urlMatch = content.match(/curl\s+['"]([^'"\s]+)['"]/)
  const url = urlMatch ? urlMatch[1] : null

  // method
  let method = 'GET'
  if (/\s-X\s+POST/.test(content) || /--data-raw|--data|-d/.test(content)) method = 'POST'

  // headers
  const headers: Record<string, string> = {}
  const headerRegex = /-H\s+'([^:]+):\s*([^']*)'/g
  let hmatch
  while ((hmatch = headerRegex.exec(content)) !== null) {
    headers[hmatch[1].trim()] = hmatch[2].trim()
  }

  // body
  let body: string | undefined = undefined
  const dataMatch = content.match(/--data-raw\s+'([\s\S]*?)'/) || content.match(/--data\s+'([\s\S]*?)'/) || content.match(/-d\s+'([\s\S]*?)'/)
  if (dataMatch) body = dataMatch[1]

  return { url, method, headers, body }
}

export async function POST({ request }: any) {
  try {
    const body = await request.json().catch(() => ({}))
    const container = body?.container
    if (!container) return new Response(JSON.stringify({ error: 'container required' }), { status: 400 })

    const projectRoot = process.cwd()
    const collectionsDir = path.join(projectRoot, 'collections')
    if (!fs.existsSync(collectionsDir)) return new Response(JSON.stringify({ error: 'collections directory not found' }), { status: 500 })

    const files = walk(collectionsDir)
    const txt = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.txt'))
    const json = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.json'))

    if (!txt) return new Response(JSON.stringify({ error: 'curl .txt not found for container', container }), { status: 404 })
    if (!json) return new Response(JSON.stringify({ error: 'json file not found for container', container }), { status: 404 })

    const curlContent = fs.readFileSync(txt, 'utf-8')
    // determine provider folder (collections/<provider>/<file>.txt)
    const relTxt = path.relative(projectRoot, txt).replace(/\\/g, '/')
    const parts = relTxt.split('/')
    const provider = parts.length >= 2 ? parts[1].toLowerCase() : ''

    // Temporarily disable Maersk until token refresh logic is implemented
    if (provider === 'maersk') {
      return new Response(JSON.stringify({ error: 'refresh for maersk is disabled for now' }), { status: 501 })
    }
    const parsed = parseCurl(curlContent)
    if (!parsed.url) return new Response(JSON.stringify({ error: 'could not parse url from curl' }), { status: 500 })

    // perform request
    const fetchOpts: any = { method: parsed.method, headers: parsed.headers }
    if (parsed.body) fetchOpts.body = parsed.body

    const res = await fetch(parsed.url, fetchOpts)
    const text = await res.text()

    // try to pretty-print JSON responses
    let outText = text
    try {
      const parsedJson = JSON.parse(text)
      outText = JSON.stringify(parsedJson, null, 4)
    } catch (_) {
      // not JSON - keep raw
    }

    // write to json file path
    fs.writeFileSync(json, outText, 'utf-8')

    return new Response(JSON.stringify({ ok: true, updatedPath: path.relative(projectRoot, json) }), { status: 200 })
  } catch (err: any) {
    console.error('refresh error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}

export const GET = () => new Response(JSON.stringify({ ok: true }), { status: 200 })
