import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const DIST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
function resolveAliasBase(specifier) {
    if (specifier.startsWith('~/')) {
        return path.join(DIST_ROOT, 'src', specifier.slice(2));
    }
    if (specifier.startsWith('@agent/')) {
        return path.join(DIST_ROOT, 'apps', 'agent', 'src', specifier.slice('@agent/'.length));
    }
    return null;
}
function resolveCompiledTarget(basePath) {
    const candidates = [
        basePath,
        `${basePath}.js`,
        `${basePath}.mjs`,
        `${basePath}.json`,
        path.join(basePath, 'index.js'),
        path.join(basePath, 'index.mjs'),
        path.join(basePath, 'index.json'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
        }
    }
    return null;
}
export async function resolve(specifier, context, defaultResolve) {
    const aliasBase = resolveAliasBase(specifier);
    if (aliasBase !== null) {
        const targetPath = resolveCompiledTarget(aliasBase);
        if (targetPath !== null) {
            return {
                shortCircuit: true,
                url: pathToFileURL(targetPath).href,
            };
        }
    }
    return defaultResolve(specifier, context);
}
