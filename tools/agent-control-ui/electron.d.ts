declare module 'electron' {
  export type Event = {
    readonly preventDefault: () => void
  }

  export type BrowserWindowConstructorOptions = {
    readonly width?: number
    readonly height?: number
    readonly minWidth?: number
    readonly minHeight?: number
    readonly show?: boolean
    readonly backgroundColor?: string
    readonly icon?: string
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
    loadURL(url: string): Promise<void>
    show(): void
    hide(): void
    focus(): void
    isVisible(): boolean
    isMinimized(): boolean
    restore(): void
    isDestroyed(): boolean
    on(event: 'ready-to-show' | 'closed', listener: () => void): void
    on(event: 'close', listener: (event: Event) => void): void
    readonly webContents: {
      openDevTools: () => void
      reload: () => void
    }
    static getAllWindows(): readonly BrowserWindow[]
  }

  export type MenuItemConstructorOptions = {
    readonly label?: string
    readonly type?: 'normal' | 'separator'
    readonly click?: () => void
  }

  export class Menu {
    static buildFromTemplate(template: readonly MenuItemConstructorOptions[]): Menu
  }

  export class Tray {
    constructor(image: string)
    setToolTip(toolTip: string): void
    setContextMenu(menu: Menu): void
    on(event: 'click' | 'double-click', listener: () => void): void
  }

  export const app: {
    whenReady: () => Promise<void>
    on: (
      event: 'activate' | 'window-all-closed' | 'second-instance',
      listener: () => void,
    ) => void
    requestSingleInstanceLock: () => boolean
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
