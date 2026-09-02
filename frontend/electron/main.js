// electron/main.js — frameless draggable widget shell.
// Spawns the Python backend (127.0.0.1:8766), hosts the React UI, cleans up on quit.
const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 8766;
const isDev = process.argv.includes('--dev');

let win = null;
let backend = null;

const fs = require('fs');

function findPython() {
  const candidates = [
    path.join(PROJECT_ROOT, '.venv', 'bin', 'python'),
    path.join(PROJECT_ROOT, '.venv', 'bin', 'python3'),
    'python3',
  ];
  // Prefer an existing venv binary; fall back to PATH python3.
  return candidates.find((c) => c === 'python3' || (path.isAbsolute(c) && fs.existsSync(c))) || 'python3';
}

function startBackend() {
  const py = findPython();
  const args = [path.join(PROJECT_ROOT, 'backend', 'api.py'), '--port', String(BACKEND_PORT)];
  if (process.env.DEADLINE_DB) args.push('--db', process.env.DEADLINE_DB);
  backend = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: PROJECT_ROOT });
  backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  backend.stderr.on('data', (d) => process.stderr.write(`[backend-err] ${d}`));
  backend.on('error', (err) => {
    process.stderr.write(`[backend] failed to start: ${err.message}\n`);
  });
  backend.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.stderr.write(`[backend] exited with code ${code}\n`);
    }
  });
}

// Keep the widget out of the Dock and Cmd-Tab. Electron flips the app back to
// a regular activation policy whenever a window is shown/focused, so this is
// re-invoked after any focus/activate (see handlers in whenReady) AND on a
// watchdog so it can never drift back into the Dock.
let reassertTimer;
function reassertWidgetPolicy() {
  try {
    app.setActivationPolicy('accessory');
    app.dock.hide();
  } catch (_) { /* cosmetic */ }
}

// Pin / Always-on-top toggle:
//   pinned=true   -> floating HUD above everything, on every Space & fullscreen
//   pinned=false  -> normal window, behind whatever app is active (desktop widget)
// Note: Electron's 'desktop' alwaysOnTop level is unreliable on modern macOS
// (the window stays at normal level), so unpinned uses setAlwaysOnTop(false),
// which reliably keeps it behind the active app / fullscreen video.
function applyWindowMode(pinned) {
  if (!win) return;
  try {
    if (pinned) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } else {
      win.setAlwaysOnTop(false);
      win.setVisibleOnAllWorkspaces(false);
    }
    reassertWidgetPolicy();
  } catch (_) { /* cosmetic */ }
}

function healthOk() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: BACKEND_PORT, path: '/api/health', timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 360,
    height: 520,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: false,
    hasShadow: true,
    backgroundColor: '#00000000',
    title: 'DEADLINES',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Pin the widget to the top-right of the primary display so it's always visible.
  try {
    const { workArea } = screen.getPrimaryDisplay();
    win.setBounds({
      x: workArea.x + workArea.width - 360 - 20,
      y: workArea.y + 24,
      width: 360,
      height: 520,
    });
  } catch (_) { /* keep default centering if screen query fails */ }

  // Default mode is UNPINNED: a normal window behind whatever app is active
  // (so it never obstructs fullscreen video). The renderer applies the user's
  // persisted pin preference on mount via the set-always-on-top IPC.
  applyWindowMode(false);

  win.once('ready-to-show', () => {
    win.show();
    win.moveTop();
    // Showing the window makes Electron re-register as a regular app; re-assert
    // the background/accessory policy so it stays out of the Dock and Cmd-Tab.
    reassertWidgetPolicy();
    setTimeout(reassertWidgetPolicy, 1500);
  });

  if (isDev) {
    win.loadURL('http://localhost:5199');
  } else {
    win.loadFile(path.join(PROJECT_ROOT, 'frontend', 'dist', 'index.html'));
  }

  // DEADLINE_DEBUG_SHOT=/path/out.png — capture the rendered window after load
  // (used by the dev/CI loop to verify the frameless UI without a display).
  if (process.env.DEADLINE_DEBUG_SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(process.env.DEADLINE_DEBUG_SHOT, img.toPNG());
          process.stdout.write(`[debug] captured ${process.env.DEADLINE_DEBUG_SHOT}\n`);
        } catch (err) {
          process.stderr.write(`[debug] capture failed: ${err.message}\n`);
        }
      }, 4500);
    });
  }

  win.on('closed', () => { win = null; });

  // Any time the widget is clicked/focused, Electron flips it back to a regular
  // app (Dock + Cmd-Tab). Re-assert accessory immediately and just after focus
  // settles so it never lingers in the Dock.
  win.on('focus', () => {
    reassertWidgetPolicy();
    if (reassertTimer) clearTimeout(reassertTimer);
    reassertTimer = setTimeout(reassertWidgetPolicy, 60);
  });

  // Right-click anywhere on the widget -> Quit (no Dock icon / app-switcher
  // entry to quit from, so this is the graceful way out).
  win.on('context-menu', (e) => {
    e.preventDefault();
    Menu.buildFromTemplate([
      { label: 'Quit Deadline Widget', click: () => app.quit() },
    ]).popup({ window: win });
  });
}

app.whenReady().then(async () => {
  // Proper desktop widget: never show in the Dock or the app switcher (Cmd-Tab).
  // Accessory policy is the definitive runtime equivalent of LSUIElement — unlike
  // app.dock.hide(), it reliably applies even when the app is already frontmost.
  app.setActivationPolicy('accessory');
  app.dock.hide();

  startBackend();
  // Give the backend a moment to bind, then show the window either way
  // (the UI retries on its own if the backend is slow).
  await new Promise((r) => setTimeout(r, 800));
  createWindow();

  // Watchdog: guarantee the widget never drifts back into the Dock, no matter
  // what triggered an activation flip (click, menu, focus). Idempotent + cheap.
  setInterval(reassertWidgetPolicy, 3000);

  app.on('activate', () => {
    reassertWidgetPolicy();
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (backend && !backend.killed) {
    try { backend.kill('SIGTERM'); } catch (_) { /* already gone */ }
  }
});

// Renderer asks us to quit (e.g. an Escape-to-close affordance).
ipcMain.on('widget-quit', () => app.quit());

// Pin / Always-on-top toggle from the renderer.
ipcMain.handle('set-always-on-top', (_e, pinned) => {
  applyWindowMode(!!pinned);
});
