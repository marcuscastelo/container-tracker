declare module 'electron' {
  export type BrowserWindowConstructorOptions = {
    readonly width?: number
    readonly height?: number
    readonly minWidth?: number
    readonly minHeight?: number
    readonly show?: boolean
    readonly backgroundColor?: string
    readonly webPreferences?: {
      readonly preload?: string
      readonly sandbox?: boolean
      readonly contextIsolation?: boolean
      readonly nodeIntegration?: boolean
    }
  }

  export class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions)
    loadFile(filePath: string): Promise<void>
    show(): void
    on(event: 'ready-to-show' | 'closed', listener: () => void): void
    readonly webContents: {
      openDevTools: () => void
    }
    static getAllWindows(): readonly BrowserWindow[]
  }

  export const app: {
    whenReady: () => Promise<void>
    on: (event: 'activate' | 'window-all-closed', listener: () => void) => void
    quit: () => void
  }

  export const ipcMain: {
    handle: (
      channel: string,
      listener: (event: unknown, ...args: readonly unknown[]) => unknown | Promise<unknown>,
    ) => void
  }

  export const ipcRenderer: {
    invoke: <T = unknown>(channel: string, ...args: readonly unknown[]) => Promise<T>
  }

  export const contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => void
  }
}
