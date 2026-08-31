// electron/main.js — frameless draggable widget shell.
// Spawns the Python backend (127.0.0.1:8766), hosts the React UI, cleans up on quit.
const { app, BrowserWindow, ipcMain } = require('electron');
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
    width: 384,
    height: 640,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
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
}

app.whenReady().then(async () => {
  startBackend();
  // Give the backend a moment to bind, then show the window either way
  // (the UI retries on its own if the backend is slow).
  await new Promise((r) => setTimeout(r, 800));
  createWindow();

  app.on('activate', () => {
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
