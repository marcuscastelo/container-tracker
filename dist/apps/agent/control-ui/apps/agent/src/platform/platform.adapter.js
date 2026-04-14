import process from 'node:process';
// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
import { linuxPlatformAdapter } from "./linux.adapter.js";
// biome-ignore lint/style/noRestrictedImports: Platform runtime needs direct relative imports for portable release bundles.
import { windowsPlatformAdapter } from "./windows.adapter.js";
function normalizeArch(arch) {
    return arch === 'x64' ? 'x64' : 'other';
}
export function resolveAgentPlatformKey(command) {
    const platform = command?.platform ?? process.platform;
    const arch = normalizeArch(command?.arch ?? process.arch);
    if (arch !== 'x64') {
        throw new Error(`unsupported architecture for agent update runtime: ${command?.arch ?? process.arch}`);
    }
    return platform === 'win32' ? 'windows-x64' : 'linux-x64';
}
export function resolvePlatformAdapter(command) {
    const key = resolveAgentPlatformKey(command);
    if (key === 'windows-x64') {
        return windowsPlatformAdapter;
    }
    return linuxPlatformAdapter;
}
