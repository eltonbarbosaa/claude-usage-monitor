const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Notification,
  shell,
  Tray,
  Menu,
  nativeImage,
} = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const { spawn } = require('node:child_process')
const { getUsage } = require('./usage')
const auth = require('./auth')
const STRINGS = require('./i18n-strings.js')

// single instance: without this, nothing stops the user from double-clicking
// the .exe/.app twice (or `bunx clauddy` in two terminals) and ending up with
// several Clauddy processes fighting over the same tray icon / config file.
// Must run before any other app.* call — the losing process quits here, on
// the spot, before creating a window or touching config/tray.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  // called before the app is 'ready', so quit() cancels startup outright —
  // whenReady() below never resolves in this process, no window gets made.
  app.quit()
}

const REPO = 'eltonbarbosaa/claude-usage-monitor'

// simple {var} substitution against the string dict for the app's current
// language (config.language) — mirrors the renderer's t() in pet.js, kept
// separate since main.js can't load a <script> the renderer uses.
function t(key, vars) {
  const lang = config?.language === 'en' ? 'en' : 'pt'
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k])
  return s
}

// data dir: kept outside the project folder so moving the repo doesn't break it.
// when CLAUDE_CONFIG_DIR is set (e.g. via direnv for multi-account setups), nest
// the widget's data under that account's Claude config dir so each account gets
// its own auth.json, config.json, and Electron userData.
const DATA_DIR = process.env.CLAUDE_CONFIG_DIR
  ? path.join(process.env.CLAUDE_CONFIG_DIR, 'usage-monitor')
  : path.join(os.homedir(), '.claude-usage-monitor')
// when isolating per-account, also pin Electron's userData under DATA_DIR so two
// widgets can run in parallel without fighting over cookies/cache. left untouched
// in the default case so existing installs keep their window position etc.
if (process.env.CLAUDE_CONFIG_DIR) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  app.setPath('userData', path.join(DATA_DIR, 'electron'))
}
// external config: edit without rebuilding the .app
const EXTERNAL_CONFIG = path.join(DATA_DIR, 'config.json')
// debug channel: `./pet <state>` writes here to force a state (dev only)
const DEBUG_FILE = path.join(DATA_DIR, 'debug.json')

let win
let pollTimer
let config
let doTick = null
const W = 276

// menu-bar (tray) mode state
let tray = null
let currentMode = 'floating' // 'floating' widget | 'menubar' popover
let trayBounds = null // last known tray icon rect, to anchor the popover
let lastBlurHide = 0 // debounce: ignore the tray click that dismissed the popover
let sessionPct = null // authoritative session % shown in the tray title

function publicConfig(c) {
  return {
    plan: c.plan,
    sessionTokenBudget: c.sessionTokenBudget,
    weeklyTokenBudget: c.weeklyTokenBudget,
    weeklyAnchorIso: c.weeklyAnchorIso,
    mode: c.mode,
    language: c.language,
    alerts: c.alerts,
    alertThresholds: c.alertThresholds,
    fireThreshold: c.fireThreshold,
  }
}

function loadConfig() {
  const defaults = {
    plan: 'max5x',
    sessionTokenBudget: 630000000,
    weeklyTokenBudget: 3450000000,
    weeklyAnchorIso: null,
    mode: 'floating', // 'floating' widget or 'menubar' popover
    language: 'pt', // 'pt' or 'en' — fork default is Portuguese
    alerts: true,
    alertThresholds: [80, 95],
    fireThreshold: 90, // session % at which the pet catches fire (tired still fixed at 100)
    pollIntervalMs: 4000,
    activeThresholdMs: 20000,
    sleepThresholdMs: 300000,
  }
  for (const p of [EXTERNAL_CONFIG, path.join(__dirname, 'config.json')]) {
    try {
      return { ...defaults, ...JSON.parse(fs.readFileSync(p, 'utf8')) }
    } catch {}
  }
  return defaults
}

// native notification when usage crosses a threshold
const armed = new Set()
function checkAlerts(config, d) {
  if (!config.alerts || !Notification.isSupported()) return
  const ths = config.alertThresholds || [80, 95]
  const scopes = [
    [t('notifScopeSession'), d.session.pct],
    [t('notifScopeWeekly'), d.week.pct],
  ]
  for (const [name, pct] of scopes) {
    for (const th of ths) {
      const key = `${name}:${th}`
      if (pct >= th) {
        if (!armed.has(key)) {
          armed.add(key)
          new Notification({
            title: t('notifTitle'),
            body: t('notifBody', { name, t: th, pct: Math.round(pct) }),
            silent: false,
          }).show()
        }
      } else {
        armed.delete(key) // re-arm when it drops below
      }
    }
  }
}

function createWindow() {
  config = loadConfig()
  const { workAreaSize } = screen.getPrimaryDisplay()
  const H = 480

  win = new BrowserWindow({
    width: W,
    height: H,
    x: workAreaSize.width - W - 24,
    y: workAreaSize.height - H - 24,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // fully transparent — Windows needs this or the window paints black
    resizable: false,
    show: false, // applyMode() reveals it (floating) or keeps it a hidden popover (menubar)
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // in menu-bar mode the popover dismisses when it loses focus (click elsewhere)
  win.on('blur', () => {
    if (currentMode === 'menubar' && win.isVisible()) {
      win.hide()
      lastBlurHide = Date.now()
    }
  })

  const tick = () => {
    if (!win || win.isDestroyed()) return
    try {
      const data = getUsage(config)
      win.webContents.send('usage', data)
      checkAlerts(config, data)
    } catch (err) {
      win.webContents.send('usage-error', String(err))
    }
  }
  doTick = tick

  win.webContents.once('did-finish-load', () => {
    tick()
    win.webContents.send('config', publicConfig(config))
    win.webContents.send('version', app.getVersion())
    win.webContents.send('auth-state', { connected: auth.isConnected() })
    pollTimer = setInterval(tick, config.pollIntervalMs)
    startUsagePoll()
    sendProfile()
    watchDebug()
    applyMode(config.mode) // reveal the widget, or set up the tray + popover
    setTimeout(autoUpdateCheck, 8000) // check once shortly after launch…
    setInterval(autoUpdateCheck, 6 * 60 * 60 * 1000) // …then every 6h
  })
}

// ---- menu-bar (tray) mode ----------------------------------------------------
// Floating mode: the widget lives bottom-right, always visible. Menu-bar mode:
// the same window becomes a popover shown under a tray icon on click. Switching
// is live — no relaunch — so the Settings toggle applies immediately.
function applyMode(mode) {
  const next = mode === 'menubar' ? 'menubar' : 'floating'
  const changed = next !== currentMode
  currentMode = next
  if (currentMode === 'menubar') {
    ensureTray()
    win.setSkipTaskbar(true)
    if (changed && win.isVisible()) win.hide() // hide only when switching in
  } else {
    destroyTray()
    if (changed || !win.isVisible()) {
      positionFloating()
      win.show()
    }
  }
  updateTray()
}

function ensureTray() {
  if (tray) return
  // macOS recolors a "template" (black+alpha) image for the light/dark menu
  // bar; Linux/Windows tray icons get no such recoloring, so they get the
  // pre-colored terracotta variant instead — a plain black icon disappears
  // on dark panels (e.g. Linux Mint's default Cinnamon taskbar).
  const isMac = process.platform === 'darwin'
  const iconFile = isMac ? 'trayTemplate.png' : 'trayColor.png'
  const img = nativeImage.createFromPath(path.join(__dirname, 'build', iconFile))
  if (isMac) img.setTemplateImage(true)
  tray = new Tray(img)
  tray.setToolTip(t('notifTitle'))
  tray.on('click', (_e, bounds) => {
    trayBounds = bounds
    togglePopover()
  })
  tray.on('right-click', () => tray.popUpContextMenu(trayMenu()))
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: t('trayOpen'), click: () => showPopover() },
    {
      label: t('trayOpenUsage'),
      click: () => shell.openExternal('https://claude.ai/settings/usage'),
    },
    { type: 'separator' },
    { label: t('trayQuit'), click: () => app.quit() },
  ])
}

function togglePopover() {
  if (Date.now() - lastBlurHide < 250) return // this click just dismissed it
  if (win.isVisible()) win.hide()
  else showPopover()
}

function showPopover() {
  positionUnderTray()
  win.show()
  win.focus()
}

// center the popover under the tray icon, kept on-screen
function positionUnderTray() {
  const b = win.getBounds()
  const { workAreaSize } = screen.getPrimaryDisplay()
  let x = workAreaSize.width - b.width - 24
  let y = 24
  if (trayBounds?.width) {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - b.width / 2)
    y = Math.round(trayBounds.y + trayBounds.height)
  }
  x = Math.max(8, Math.min(x, workAreaSize.width - b.width - 8))
  win.setPosition(x, y)
}

function positionFloating() {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const b = win.getBounds()
  win.setPosition(workAreaSize.width - b.width - 24, workAreaSize.height - b.height - 24)
}

// the tray shows the live session % (macOS title), turning 🔥 near the limit
function updateTray() {
  if (!tray) return
  if (sessionPct == null) {
    if (process.platform === 'darwin') tray.setTitle('')
    tray.setToolTip(t('trayTooltipDisconnected'))
    return
  }
  const pct = Math.round(sessionPct)
  const hot = pct >= (config?.fireThreshold ?? 90)
  if (process.platform === 'darwin') tray.setTitle(hot ? ` ${pct}% 🔥` : ` ${pct}%`)
  tray.setToolTip(t('trayTooltipSession', { pct }))
}

// send real usage to the renderer and refresh the tray title in one place
function pushRealUsage(u) {
  sessionPct = u?.session ? u.session.pct : null
  updateTray()
  if (win && !win.isDestroyed()) win.webContents.send('real-usage', u)
}

// resize the window to fit the content
ipcMain.on('resize', (_e, w, h) => {
  if (!win || win.isDestroyed()) return
  const width = Math.max(100, Math.round(w))
  const height = Math.max(110, Math.round(h))
  win.setContentSize(width, height)
  if (currentMode === 'menubar') {
    if (win.isVisible()) positionUnderTray() // keep it anchored under the tray
  } else {
    const { workAreaSize } = screen.getPrimaryDisplay()
    win.setPosition(workAreaSize.width - width - 24, workAreaSize.height - height - 24)
  }
})

ipcMain.on('open-usage', () => shell.openExternal('https://claude.ai/settings/usage'))

// watch the debug file; forward forced states to the renderer
function watchDebug() {
  fs.watchFile(DEBUG_FILE, { interval: 400 }, () => {
    if (!win || win.isDestroyed()) return
    try {
      const txt = fs.readFileSync(DEBUG_FILE, 'utf8').trim()
      win.webContents.send('debug-state', txt ? JSON.parse(txt) : null)
    } catch {}
  })
}

// ---- real usage via OAuth (authoritative %), polled slowly with 429 backoff ----
let usageTimer = null
let usageBackoff = 5 * 60 * 1000
function scheduleUsagePoll() {
  clearTimeout(usageTimer)
  if (auth.isConnected()) usageTimer = setTimeout(pollUsage, usageBackoff)
}
async function pollUsage() {
  try {
    const u = await auth.fetchUsage()
    usageBackoff = 5 * 60 * 1000
    pushRealUsage(u)
  } catch (e) {
    if (e && e.status === 429) {
      usageBackoff = Math.min(usageBackoff * 2, 30 * 60 * 1000)
    } else if (e && e.status === 401) {
      auth.clear()
      pushRealUsage(null)
      if (win && !win.isDestroyed()) {
        win.webContents.send('auth-state', { connected: false })
        win.webContents.send('profile', null)
      }
    }
  }
  scheduleUsagePoll()
}
function startUsagePoll() {
  if (auth.isConnected()) pollUsage()
}

// push the logged-in account's identity (email + plan) to the renderer
async function sendProfile() {
  if (!auth.isConnected()) return
  try {
    const p = await auth.fetchProfile()
    if (win && !win.isDestroyed()) win.webContents.send('profile', p)
  } catch {} // non-fatal: the chip just stays hidden
}

ipcMain.on('auth-start', () => shell.openExternal(auth.begin()))
ipcMain.on('auth-code', async (_e, code) => {
  const ok = () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('auth-state', { connected: true })
      win.webContents.send('auth-result', { ok: true })
    }
    sendProfile()
  }
  try {
    await auth.complete(code)
    usageBackoff = 5 * 60 * 1000
    try {
      const u = await auth.fetchUsage() // validate the token
      ok()
      pushRealUsage(u)
    } catch (e) {
      if (e && e.status === 429) {
        // token is fine, the usage endpoint is just throttled — keep it and retry later
        ok()
      } else {
        throw e
      }
    }
    scheduleUsagePoll()
  } catch (err) {
    auth.clear() // don't keep an invalid token
    if (win && !win.isDestroyed())
      win.webContents.send('auth-result', { ok: false, error: String(err?.message || err) })
  }
})
ipcMain.on('auth-logout', () => {
  auth.clear()
  clearTimeout(usageTimer)
  pushRealUsage(null)
  if (win && !win.isDestroyed()) {
    win.webContents.send('auth-state', { connected: false })
    win.webContents.send('profile', null)
  }
})

ipcMain.on('save-config', (_e, patch) => {
  let obj = {}
  for (const p of [EXTERNAL_CONFIG, path.join(__dirname, 'config.json')]) {
    try {
      obj = JSON.parse(fs.readFileSync(p, 'utf8'))
      break
    } catch {}
  }
  Object.assign(obj, patch)
  try {
    fs.mkdirSync(path.dirname(EXTERNAL_CONFIG), { recursive: true })
    fs.writeFileSync(EXTERNAL_CONFIG, JSON.stringify(obj, null, 2))
  } catch {}
  config = loadConfig()
  armed.clear() // re-arm alerts with new thresholds
  if (doTick) doTick()
  if (win && !win.isDestroyed()) win.webContents.send('config', publicConfig(config))
  applyMode(config.mode) // switch between floating widget and menu-bar popover live
})

// ---- self-update (checks the latest GitHub release, runs install.sh) ---------
async function fetchLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'User-Agent': 'Clauddy', Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
async function fetchLatestTag() {
  return (await fetchLatestRelease()).tag_name // e.g. "v1.9.1"
}
// compare two "1.2.3" versions; >0 if a is newer than b
function cmpVer(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number)
  const pb = String(b).replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}
async function computeUpdate() {
  const latest = await fetchLatestTag()
  return { latest, available: cmpVer(latest, app.getVersion()) > 0 }
}
// manual check (from the Settings button): shows checking / result / error
ipcMain.on('check-updates', async () => {
  if (!win || win.isDestroyed()) return
  const send = (s) => !win.isDestroyed() && win.webContents.send('update-status', s)
  send({ state: 'checking' })
  try {
    const u = await computeUpdate()
    send(u.available ? { state: 'available', latest: u.latest } : { state: 'uptodate' })
  } catch (e) {
    send({ state: 'error', message: String(e?.message || e) })
  }
})
// silent background check: only speaks up when there's actually an update, so
// the renderer can badge the gear without any UI churn on the common case
async function autoUpdateCheck() {
  if (!win || win.isDestroyed()) return
  try {
    const u = await computeUpdate()
    if (u.available) win.webContents.send('update-status', { state: 'available', latest: u.latest })
  } catch {} // offline / rate-limited: stay quiet, try again on the next tick
}
ipcMain.on('do-update', async () => {
  const send = (s) => win && !win.isDestroyed() && win.webContents.send('update-status', s)

  if (process.platform === 'darwin') {
    send({ state: 'updating' })
    const cmd = `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`
    const child = spawn('/bin/bash', ['-lc', cmd], { detached: true, stdio: 'ignore' })
    child.unref()
    // quit so the installer can replace the running .app and relaunch the new build
    setTimeout(() => app.quit(), 1500)
    return
  }

  if (process.platform === 'win32') {
    // Same idea as macOS: download the NSIS installer for the latest release
    // and run it silently (/S) — it closes the running app, replaces the
    // install, and relaunches (runAfterFinish in the build config), so this
    // needs no more babysitting than the curl|bash path above.
    try {
      const release = await fetchLatestRelease()
      const asset = release.assets?.find((a) => a.name.endsWith('-setup.exe'))
      if (!asset) {
        shell.openExternal(`https://github.com/${REPO}/releases/latest`)
        return
      }
      send({ state: 'updating' })
      const res = await fetch(asset.browser_download_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const installerPath = path.join(os.tmpdir(), asset.name)
      fs.writeFileSync(installerPath, Buffer.from(await res.arrayBuffer()))
      const child = spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore' })
      child.unref()
      setTimeout(() => app.quit(), 1500)
    } catch (e) {
      send({ state: 'error', message: String(e?.message || e) })
    }
    return
  }

  // Linux: no silent installer format shipped (AppImage/tar.gz) — same
  // fallback as before.
  shell.openExternal(`https://github.com/${REPO}/releases/latest`)
})

ipcMain.on('quit', () => app.quit())

// Electron's login-item API only covers macOS (SMAppService) and Windows (the
// registry Run key) — @platform darwin,win32 in electron.d.ts, a no-op on
// Linux. The real "start with the system" mechanism there is the XDG
// Autostart spec: a .desktop file in ~/.config/autostart, read by every major
// desktop environment's session manager at login (GNOME, KDE, XFCE, Cinnamon,
// MATE) — same role as the registry key or SMAppService, just file-based.
function enableLinuxAutostart() {
  const exec = process.env.APPIMAGE || process.execPath
  const autostartDir = path.join(os.homedir(), '.config', 'autostart')
  const desktopFile = path.join(autostartDir, 'clauddy.desktop')
  // AppImage isn't registered in the system's hicolor icon theme, so a bare
  // "Icon=clauddy" name won't resolve — copy the icon to a path that outlives
  // the AppImage's temp mount and reference it absolutely instead.
  const iconFile = path.join(DATA_DIR, 'icon.png')
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.copyFileSync(path.join(__dirname, 'build', 'icon.png'), iconFile)
  const entry = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Clauddy',
    'Comment=A cute pixel-art desktop pet that tracks your Claude Code usage',
    `Exec="${exec}"`,
    `Icon=${iconFile}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
  if (fs.existsSync(desktopFile) && fs.readFileSync(desktopFile, 'utf8') === entry) return
  fs.mkdirSync(autostartDir, { recursive: true })
  fs.writeFileSync(desktopFile, entry)
}

// Windows/macOS: app.setLoginItemSettings({ openAtLogin: true }) is a no-op
// once Electron already thinks it's enabled — it doesn't re-check that the
// registered path still matches the CURRENT install (e.g. moved between an
// old manual copy and the real installer's folder, or a version upgrade
// that reinstalls elsewhere). A stale entry silently fails to launch at the
// next login. Forcing an off→on toggle makes Electron rewrite it with
// `process.execPath` every time, so it self-heals instead of drifting.
function refreshLoginItem() {
  app.setLoginItemSettings({ openAtLogin: false })
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false, path: process.execPath })
}

// a second launch attempt (double-click, `bunx clauddy` again…) lands here
// instead of opening its own window — just bring the real one forward.
app.on('second-instance', () => {
  if (!win || win.isDestroyed()) return
  if (currentMode === 'menubar') {
    showPopover()
  } else {
    if (!win.isVisible()) {
      positionFloating()
      win.show()
    }
    win.focus()
  }
})

app.whenReady().then(() => {
  // Windows toast notifications need an explicit AppUserModelID to show reliably
  if (process.platform === 'win32') app.setAppUserModelId('app.clauddy')
  createWindow()
  // open at login (packaged app only)
  if (app.isPackaged) {
    if (process.platform === 'linux') {
      enableLinuxAutostart()
    } else {
      refreshLoginItem()
    }
  }
})

app.on('window-all-closed', () => {
  if (pollTimer) clearInterval(pollTimer)
  fs.unwatchFile(DEBUG_FILE)
  destroyTray()
  app.quit()
})

if (process.platform === 'darwin' && app.dock) app.dock.hide()
