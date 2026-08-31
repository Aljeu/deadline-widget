// electron/main.js — frameless draggable widget shell.
// Spawns the Python backend (127.0.0.1:8766), hosts the React UI, cleans up on quit.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKEND_PORT = 8766;
const isDev = process.argv.includes('--dev');

let win = null;
let backend = null;

function findPython() {
  const candidates = [
    path.join(PROJECT_ROOT, '.venv', 'bin', 'python'),
    path.join(PROJECT_ROOT, '.venv', 'bin', 'python3'),
    'python3',
  ];
  return candidates;
}

function startBackend() {
  const args = [path.join(PROJECT_ROOT, 'backend', 'api.py'), '--port', String(BACKEND_PORT)];
  for (const py of findPython()) {
    try {
      backend = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: PROJECT_ROOT });
      backend.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
      backend.stderr.on('data', (d) => process.stderr.write(`[backend-err] ${d}`));
      backend.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          process.stderr.write(`[backend] exited with code ${code}\n`);
        }
      });
      return;
    } catch (err) {
      // try next candidate
    }
  }
  process.stderr.write('[backend] could not spawn python backend\n');
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
