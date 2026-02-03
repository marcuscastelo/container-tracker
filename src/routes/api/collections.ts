// API route: return the JSON samples under /collections as a simple array
// This handler runs on the server and uses dynamic import of Node fs/path so
// it works in ESM/Nitro environments without top-level await.
export async function GET() {
  try {
    const fs = await import('fs')
    const path = await import('path')

    const projectRoot = (typeof process !== 'undefined' && typeof process.cwd === 'function') ? process.cwd() : '.'
    const collectionsDir = path.join(projectRoot, 'collections')

    // ensure collections dir exists
    const stat = await fs.promises.stat(collectionsDir).catch(() => null)
    if (!stat || !stat.isDirectory()) {
      return new Response(JSON.stringify({ error: 'collections directory not found' }), { status: 404 })
    }

    // recursively walk directory
    async function walk(dir: string): Promise<string[]> {
      const out: string[] = []
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const ent of entries) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) out.push(...await walk(full))
        else if (ent.isFile() && full.endsWith('.json')) out.push(full)
      }
      return out
    }

    const files = await walk(collectionsDir)
    const samples: Array<{ path: string; raw: any }> = []
    for (const f of files) {
      try {
        const txt = await fs.promises.readFile(f, 'utf-8')
        const raw = JSON.parse(txt)
        const rel = path.relative(projectRoot, f).replace(/\\/g, '/')
        samples.push({ path: rel, raw })
      } catch (err) {
        // ignore individual parse errors but continue
        console.warn('api/collections: failed to read or parse', f, String(err))
      }
    }

    return new Response(JSON.stringify(samples), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('api/collections GET error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}

export const POST = GET
