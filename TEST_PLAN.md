# Test Plan for Maersk Refresh Route

## Pre-requisites
1. Dev server running (`npm run dev`)
2. Container number: `MNBU3094033` (or any valid Maersk container)

## Test Cases

### Test 1: Basic call (will likely get 403)
```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0"
```

**Expected**: 
- 403 response with Akamai Access Denied
- Creates `collections/maersk/MNBU3094033.json.devtools.json` with diagnostics

### Test 2: With persistent context (best chance)
```bash
# Replace with your actual Chrome profile path
PROFILE_PATH="$HOME/.config/google-chrome/Default"

curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0&userDataDir=$PROFILE_PATH"
```

**Expected**:
- Either 200 OK (success) or 403 (still blocked but with session cookies)
- Browser window opens showing Maersk tracking page
- Creates both `.json` and `.devtools.json` files

### Test 3: Hold mode for manual inspection
```bash
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?hold=1&headless=0&userDataDir=$HOME/.config/google-chrome/Default"
```

**Expected**:
- Browser stays open
- You can inspect DevTools Network tab
- If API call succeeded, JSON is already written
- Press Ctrl+C in terminal to close

## Verification Steps

After each test, check:

1. **Server logs** (in dev server terminal):
```
[maersk-refresh] Starting capture for container: MNBU3094033
[maersk-refresh] Warmup: visiting homepage to establish session
[maersk-refresh] Navigating to: https://www.maersk.com/tracking/MNBU3094033
[maersk-refresh] Intercepted request: https://api.maersk.com/synergy/tracking/MNBU3094033?operator=MAEU
[maersk-refresh] Captured response: { url: '...', status: 200, bodyLength: 4523 }
[maersk-refresh] Wrote collections/maersk/MNBU3094033.json (4523 bytes)
```

2. **Output files**:
```bash
ls -lh collections/maersk/MNBU3094033.json*
cat collections/maersk/MNBU3094033.json.devtools.json | jq '.response.status'
```

3. **Response body** (if successful):
```bash
cat collections/maersk/MNBU3094033.json | jq '.origin, .destination'
```

## Troubleshooting

### Still getting 403 with persistent context?

1. **Build fresh session**:
```bash
# Create a dedicated profile for automation
mkdir -p /tmp/maersk-automation-profile

# First run: let browser build session
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?hold=1&headless=0&userDataDir=/tmp/maersk-automation-profile"

# When browser opens:
# 1. Click around on www.maersk.com
# 2. Maybe solve a CAPTCHA if prompted
# 3. Wait for the API call in Network tab (should show 200)
# 4. Press Ctrl+C

# Second run: use the warmed profile
curl "http://localhost:3000/api/refresh-maersk/MNBU3094033?headless=0&userDataDir=/tmp/maersk-automation-profile"
```

2. **Check DevTools diagnostics**:
```bash
cat collections/maersk/MNBU3094033.json.devtools.json | jq '{
  status: .response.status,
  telemetry: .request.headers["Akamai-BM-Telemetry"][:50],
  cookies: (.cookies | length),
  userDataDir: .diagnostics.userDataDir
}'
```

If `telemetry` is present and cookies > 5, the stealth is working — just need better session.

## Success Criteria

✅ Route compiles and runs without errors
✅ Browser launches (when headless=0)
✅ Warmup navigation to homepage succeeds
✅ Route interception fires (see log: "Intercepted request")
✅ Response captured (status 200 or 403)
✅ Files written: `.json` and `.devtools.json`
✅ Diagnostics include request headers with Akamai-BM-Telemetry
✅ launchPersistentContext works when userDataDir provided
✅ Hold mode keeps browser open

## Next Steps if All Tests Fail

1. Manual capture workflow (see MAERSK_REFRESH_GUIDE.md)
2. Try different Chrome profiles
3. Try from different IP (VPN)
4. Consider using real logged-in Maersk account session
