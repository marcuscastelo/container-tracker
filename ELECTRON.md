# Electron Integration

This project is configured to run as an Electron desktop application.

## Development

To run in development mode (hot reload):

```bash
npm run electron:dev
```

This will:
1. Start the Vinxi dev server
2. Wait for the server to be ready
3. Launch Electron pointing to the local server

## Building for Production

### Linux (AppImage)

```bash
npm run electron:build:linux
```

The AppImage will be created in `dist-electron/`.

### Windows (EXE/NSIS)

```bash
npm run electron:build:win
```

### macOS (DMG)

```bash
npm run electron:build:mac
```

## How it Works

1. **Main Process** (`electron/main.js`): 
   - Starts the SolidStart server as a child process
   - Waits for the server to be ready on port 3000
   - Creates a BrowserWindow that loads `http://localhost:3000`
   - Handles server lifecycle (start/stop)

2. **Preload Script** (`electron/preload.js`):
   - Provides a secure bridge between the renderer and Node.js
   - Exposes platform info to the web app

3. **Production Build**:
   - The SolidStart app is built with `vinxi build`
   - The `.output` folder is bundled as `extraResources/server`
   - Electron runs `npm start` in the server folder

## Icons

Place your icons in the `public/` folder:
- `icon.png` - For Linux (256x256 or larger recommended)
- `icon.ico` - For Windows
- `icon.icns` - For macOS

## Troubleshooting

### Server doesn't start
- Check if port 3000 is already in use
- Look at the console output for server errors

### Window is blank
- The server might take a moment to start
- Check Developer Tools (Ctrl+Shift+I in dev mode) for errors

### Build fails
- Ensure all dependencies are installed: `npm install`
- Run the SolidStart build first: `npm run build`
