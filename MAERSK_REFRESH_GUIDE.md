# Maersk Container Tracking Refresh Guide

## Overview

The `/api/refresh-maersk/[container]` endpoint captures Maersk container tracking data by intercepting the browser's API request to `https://api.maersk.com/synergy/tracking/{container}`.

**Key approach**: We use Playwright to open the Maersk tracking page and intercept the response that the page itself fetches (via CDP route interception). This avoids re-implementing Akamai's bot detection logic.

## Quick Start

### 1. Basic Usage (Likely to be Blocked by Akamai)

```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0"
```

**Result**: Usually returns 403 "Access Denied" because Akamai detects automation.

### 2. Using a Persistent Browser Profile (Recommended)

Akamai requires valid session cookies and browser fingerprints. The best approach is to use an existing Chrome profile where you've already logged into Maersk.

#### Step-by-step:

**a) Find your Chrome profile directory**

- **Linux**: `~/.config/google-chrome/Default` or `~/.config/chromium/Default`
- **macOS**: `~/Library/Application Support/Google/Chrome/Default`
- **Windows**: `%LOCALAPPDATA%\Google\Chrome\User Data\Default`

**b) (Optional) Log into Maersk in your regular Chrome**

Open Chrome normally and visit `https://www.maersk.com`. If you have an account, log in. This establishes cookies and session state.

**c) Call the API with `userDataDir`**

```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0&userDataDir=/home/user/.config/google-chrome/Default"
```

Replace `/home/user/.config/google-chrome/Default` with your actual Chrome profile path.

**d) Or set an environment variable**

```bash
export CHROME_USER_DATA_DIR=/home/user/.config/google-chrome/Default
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0"
```

### 3. Hold Mode (For Manual Intervention)

If Akamai still blocks, use `?hold=1` to keep the browser open so you can manually solve CAPTCHAs or inspect what's wrong:

```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0&hold=1&userDataDir=/path/to/profile"
```

- The browser will stay open
- Check the Network tab in DevTools to see if the API request succeeded
- Press Ctrl+C in the terminal to close

## Query Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `headless` | `0`, `1`, `true`, `false` | `false` | Run browser in headless mode (no UI) |
| `hold` | `1`, `0` | `0` | Keep browser open after capture for manual inspection |
| `userDataDir` | file path | `null` | Chrome profile directory for persistent session |
| `timeout` | milliseconds | `60000` | Navigation timeout |

## Output Files

When successful, the route writes two files:

### `collections/maersk/{container}.json`
The captured JSON response from Maersk API:
```json
{
  "origin": {
    "terminal": "...",
    "location": "..."
  },
  "destination": {...},
  "containers": [...]
}
```

### `collections/maersk/{container}.json.devtools.json`
Diagnostics and metadata proving the capture was done via browser:
```json
{
  "request": {
    "url": "https://api.maersk.com/synergy/tracking/...",
    "method": "GET",
    "headers": {
      "Akamai-BM-Telemetry": "...",
      "Consumer-Key": "..."
    }
  },
  "response": {
    "status": 200,
    "headers": {...}
  },
  "cookies": [...],
  "userAgent": "...",
  "capturedAt": "2026-02-02T...",
  "source": "playwright-route-interception"
}
```

## Troubleshooting

### Still Getting 403 "Access Denied"

**Symptoms**:
- `.devtools.json` shows `status: 403`
- `blockedResponse` contains HTML `<TITLE>Access Denied</TITLE>`

**Causes**:
1. **Ephemeral session** (no `userDataDir`) — Akamai detects fresh browser with no history
2. **Automation fingerprinting** — Playwright leaves detectable traces
3. **IP/rate limiting** — Too many requests in short time
4. **Missing cookies** — Profile doesn't have recent Maersk session

**Solutions**:

#### A) Use a Real Browser Profile with Recent Activity
```bash
# 1. Open Chrome normally
google-chrome --user-data-dir=/tmp/maersk-profile

# 2. Visit www.maersk.com and click around (build session history)
# 3. Close Chrome
# 4. Use that profile:
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?userDataDir=/tmp/maersk-profile&headless=0"
```

#### B) Manual Capture Workflow (Guaranteed to Work)
If automation keeps failing, use hold mode and manually trigger:

```bash
# 1. Start with hold mode
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?hold=1&headless=0&userDataDir=/path/to/profile"

# 2. Browser opens — you see the tracking page
# 3. Open DevTools (F12) → Network tab
# 4. Filter for "synergy/tracking"
# 5. Refresh the page if needed (Ctrl+R)
# 6. When you see the 200 OK response, the route has already captured it
# 7. Press Ctrl+C in terminal
# 8. Check collections/maersk/MNBU3094033.json
```

#### C) Try Non-Headless Mode
Headless mode is more easily detected:
```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0&userDataDir=/path/to/profile"
```

#### D) Add Delays Between Requests
Akamai may rate-limit. Wait 30-60 seconds between calls.

### No API Request Intercepted

**Symptoms**:
- Error: `"No API request intercepted"`
- No `.devtools.json` file

**Causes**:
- Invalid container number
- Maersk changed their API URL pattern
- Page loaded but didn't make the API call

**Solutions**:
1. Verify container number is valid on www.maersk.com manually
2. Use `?hold=1` and check DevTools Network tab to see what URL the page actually calls
3. Update the route pattern in `[container].ts` if Maersk changed their API

### Browser Fails to Launch

**Symptoms**:
- Error: `"puppeteer launch failed"` or similar

**Solutions**:
1. Install Chrome/Chromium:
   ```bash
   # Ubuntu/Debian
   sudo apt install chromium-browser
   
   # macOS
   brew install --cask google-chrome
   ```

2. Or set `CHROME_PATH`:
   ```bash
   export CHROME_PATH=/usr/bin/google-chrome
   ```

## Advanced: Understanding the Capture Flow

1. **Launch**: Playwright launches Chrome with stealth args (`--disable-blink-features=AutomationControlled`)
2. **Warmup**: Route visits `www.maersk.com` homepage first to build session context
3. **Route Interception**: Before navigation, registers handler for `**/synergy/tracking/**` pattern
4. **Navigation**: Opens `www.maersk.com/tracking/{container}`
5. **Page Loads**: Maersk's JavaScript executes, generates Akamai telemetry
6. **API Call**: Page makes XHR/fetch to `api.maersk.com/synergy/tracking/...`
7. **Interception**: Playwright's route handler captures the request/response
8. **Save**: Writes JSON body to file + diagnostics metadata

**Key insight**: We don't make the API request ourselves — we let Maersk's own JavaScript do it (with all the correct fingerprinting) and just intercept the result.

## Examples

### Successful capture (non-headless, with profile)
```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0&userDataDir=$HOME/.config/google-chrome/Default"
```

**Response**:
```json
{
  "ok": true,
  "updatedPath": "collections/maersk/MNBU3094033.json",
  "diagnosticsPath": "collections/maersk/MNBU3094033.json.devtools.json",
  "status": 200,
  "bytesWritten": 4523
}
```

### Akamai block (diagnostics saved for inspection)
```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033"
```

**Response**:
```json
{
  "error": "Access Denied by Akamai",
  "hint": "The API request was blocked. To fix this:\\n1. Open Chrome normally and log into www.maersk.com\\n2. Find your Chrome profile directory...\\n3. Call the API with ?userDataDir=/path/to/profile",
  "diagnostics": {
    "status": 403,
    "url": "https://api.maersk.com/synergy/tracking/...",
    "diagnosticsFile": "collections/maersk/MNBU3094033.json.devtools.json",
    "cookiesPresent": 8,
    "userDataDir": "none (ephemeral session)"
  }
}
```

## Implementation Notes

- **Technology**: Playwright (better Service Worker support than Puppeteer)
- **Launch mode**: `launchPersistentContext` when `userDataDir` provided, `launch` + `newContext` otherwise
- **Stealth**: Navigator overrides, Chrome runtime mocking, webdriver removal
- **Human simulation**: Random delays (1-3s), mouse movements, scrolling
- **Warmup**: Visits homepage before tracking page to avoid cold-start detection

## Limitations

- **Akamai detection**: Even with stealth, Akamai may block automated browsers
- **Rate limiting**: Multiple rapid requests from same IP may be blocked
- **Login required**: Some containers may require Maersk account login
- **Profile conflicts**: Using an active Chrome profile may cause "Profile in use" errors (close Chrome first)

## Alternative: Manual DevTools Workflow

If all automation fails, capture manually and copy the JSON:

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Visit `https://www.maersk.com/tracking/{container}`
4. Find the request to `api.maersk.com/synergy/tracking/...`
5. Right-click → Copy → Copy Response
6. Save to `collections/maersk/{container}.json`

This is what the automated route tries to replicate.
