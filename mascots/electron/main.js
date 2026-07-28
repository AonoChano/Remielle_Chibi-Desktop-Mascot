const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { EyeTrackingService } = require('./eye-tracking-service');

let petWindow = null;
let panelWindow = null;
let tray = null;
let eyeTrackingService = null;

// --- Settings persistence ---
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.warn('[settings] Failed to load:', e.message);
  }
  return {};
}

function saveSettings(partial) {
  try {
    const existing = loadSettings();
    const merged = { ...existing, ...partial };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) {
    console.warn('[settings] Failed to save:', e.message);
  }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function readEyeTrackingSetting() {
  const saved = loadSettings();
  return typeof saved.eyeTrackingEnabled === 'boolean'
    ? saved.eyeTrackingEnabled
    : true;
}

function sendToWindow(window, channel, ...args) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(channel, ...args);
}

function createEyeTrackingService() {
  return new EyeTrackingService({
    initialEnabled: readEyeTrackingSetting(),
    getCursorPoint: () => screen.getCursorScreenPoint(),
    getPetBounds: () => {
      if (!petWindow || petWindow.isDestroyed()) return null;
      return petWindow.getBounds();
    },
    sendCursor: sample => sendToWindow(petWindow, 'cursor-position', sample),
    saveSetting: enabled => saveSettings({ eyeTrackingEnabled: enabled }),
    broadcastSetting: enabled => {
      sendToWindow(petWindow, 'eye-tracking-changed', enabled);
      sendToWindow(panelWindow, 'eye-tracking-changed', enabled);
    },
  });
}

function createPetWindow() {
  const saved = loadSettings();

  petWindow = new BrowserWindow({
    x: saved.petX,
    y: saved.petY,
    width: saved.size || saved.petSize || 420,
    height: saved.size || saved.petSize || 420,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile('pet.html');
  petWindow.setIgnoreMouseEvents(false);
  petWindow.webContents.once('did-finish-load', () => {
    if (eyeTrackingService) eyeTrackingService.setPetAvailable(true);
  });

  const savePetPos = debounce(() => {
    if (petWindow && !petWindow.isDestroyed()) {
      const [x, y] = petWindow.getPosition();
      saveSettings({ petX: x, petY: y });
    }
  }, 500);

  const savePetSize = debounce(() => {
    if (petWindow && !petWindow.isDestroyed()) {
      const [w] = petWindow.getBounds();
      saveSettings({ petSize: w });
    }
  }, 500);

  petWindow.on('move', savePetPos);
  petWindow.on('resize', savePetSize);

  petWindow.on('closed', () => {
    if (eyeTrackingService) eyeTrackingService.setPetAvailable(false);
    petWindow = null;
  });
}

function createPanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.focus();
    return;
  }

  const saved = loadSettings();

  panelWindow = new BrowserWindow({
    x: saved.panelX,
    y: saved.panelY,
    minWidth: 640,
    minHeight: 480,
    width: 860,
    height: 640,
    title: '小蕾米管理面板',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  panelWindow.loadFile('panel.html');

  const savePanelPos = debounce(() => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      const [x, y] = panelWindow.getPosition();
      saveSettings({ panelX: x, panelY: y });
    }
  }, 500);

  panelWindow.on('move', savePanelPos);

  panelWindow.on('closed', () => {
    panelWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'logo.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('小蕾米桌宠');

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开管理面板', click: () => createPanelWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => createPanelWindow());
}

app.whenReady().then(() => {
  eyeTrackingService = createEyeTrackingService();
  createPetWindow();
  createTray();
});

app.on('before-quit', () => {
  if (eyeTrackingService) eyeTrackingService.destroy();
});

app.on('window-all-closed', () => {
  // 保留托盘运行，不退出
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPetWindow();
  }
});

// IPC
ipcMain.on('drag-pet', (event, dx, dy) => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    petWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  }
});

ipcMain.on('open-panel', () => {
  createPanelWindow();
});

ipcMain.on('play-animation', (event, animName) => {
  if (petWindow) {
    petWindow.webContents.send('play-animation', animName);
  }
});

ipcMain.on('set-expression', (event, expression) => {
  if (petWindow) {
    petWindow.webContents.send('set-expression', expression);
  }
});

ipcMain.on('set-mouse-events', (event, ignore) => {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('toggle-light', (event, enabled) => {
  if (petWindow) {
    petWindow.webContents.send('toggle-light', enabled);
  }
});

ipcMain.on('set-test-mode', (event, enabled) => {
  if (typeof enabled !== 'boolean') return;
  sendToWindow(petWindow, 'test-mode-changed', enabled);
});

ipcMain.handle('get-eye-tracking-enabled', () => {
  return eyeTrackingService
    ? eyeTrackingService.getEnabled()
    : readEyeTrackingSetting();
});

ipcMain.handle('set-eye-tracking-enabled', (event, enabled) => {
  if (!eyeTrackingService) {
    throw new Error('Eye tracking service is not ready');
  }
  return eyeTrackingService.setEnabled(enabled);
});

ipcMain.on('set-size', (event, size) => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    const currentBounds = petWindow.getBounds();
    const centerX = x + currentBounds.width / 2;
    const centerY = y + currentBounds.height / 2;
    petWindow.setSize(size, size);
    petWindow.setPosition(
      Math.round(centerX - size / 2),
      Math.round(centerY - size / 2)
    );
    petWindow.webContents.send('apply-scale', size / 420);
    saveSettings({ petSize: size });
  }
});

// --- i18n ---
let currentLocale = loadSettings().locale || 'zh-CN';

function scanLocales() {
  const localesDir = path.join(__dirname, 'locales');
  const locales = {};
  try {
    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
        if (content._meta && content._meta.locale && content._meta.display_name) {
          locales[content._meta.locale] = content;
        }
      } catch (e) {
        console.warn(`[i18n] Skipping invalid locale file: ${file} - ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`[i18n] Could not scan locales directory: ${e.message}`);
  }
  return locales;
}

const localeCache = scanLocales();

ipcMain.handle('get-locales', () => {
  const result = [];
  for (const [code, dict] of Object.entries(localeCache)) {
    result.push({ code: code, displayName: dict._meta.display_name });
  }
  return result;
});

ipcMain.handle('get-locale-dict', (event, localeCode) => {
  return localeCache[localeCode] || null;
});

ipcMain.on('set-locale', (event, localeCode) => {
  if (localeCache[localeCode]) {
    currentLocale = localeCode;
    saveSettings({ locale: localeCode });
    const dict = localeCache[localeCode];
    if (petWindow) petWindow.webContents.send('locale-changed', localeCode, dict);
    if (panelWindow) panelWindow.webContents.send('locale-changed', localeCode, dict);
  }
});

ipcMain.handle('get-current-locale', () => {
  return currentLocale;
});

// --- External links & settings IPC ---
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('load-settings', () => {
  return loadSettings();
});

ipcMain.handle('save-settings', (event, partial) => {
  saveSettings(partial);
});
