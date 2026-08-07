const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, screen } = require('electron');
const path = require('path');
const { EyeTrackingService } = require('./eye-tracking-service');
const { centerWindowInWorkArea } = require('./window-positioning');
const {
  AlwaysOnTopService,
  readAlwaysOnTopSetting,
} = require('./always-on-top-service');
const { createSettingsStore, debounce, BASE_SIZE } = require('./settings-store');
const { createI18nService } = require('./i18n-service');

let petWindow = null;
let panelWindow = null;
let tray = null;
let eyeTrackingService = null;
let alwaysOnTopService = null;
let testModeEnabled = false;

const settingsStore = createSettingsStore(app.getPath('userData'));
const { load: loadSettings, save: saveSettings, migrate: migrateSettings } = settingsStore;

const i18nService = createI18nService(__dirname, settingsStore);

function readEyeTrackingSetting() {
  const saved = loadSettings();
  return typeof saved.eyeTrackingEnabled === 'boolean'
    ? saved.eyeTrackingEnabled
    : true;
}

function readTestModeSetting() {
  return loadSettings().testMode === true;
}

function sendToWindow(window, channel, ...args) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(channel, ...args);
}

// --- Service factories ---

function createEyeTrackingService() {
  return new EyeTrackingService({
    initialEnabled: readEyeTrackingSetting(),
    initialSuspended: testModeEnabled,
    getCursorPoint: () => screen.getCursorScreenPoint(),
    getPetBounds: () => {
      if (!petWindow || petWindow.isDestroyed()) return null;
      return petWindow.getBounds();
    },
    sendCursor: sample => sendToWindow(petWindow, 'cursor-position', sample),
    saveSetting: enabled => saveSettings(
      { eyeTrackingEnabled: enabled },
      { throwOnError: true }
    ),
    broadcastSetting: enabled => {
      sendToWindow(petWindow, 'eye-tracking-changed', enabled);
      sendToWindow(panelWindow, 'eye-tracking-changed', enabled);
    },
  });
}

function createAlwaysOnTopService() {
  return new AlwaysOnTopService({
    initialEnabled: readAlwaysOnTopSetting(loadSettings()),
    persistSetting: enabled => saveSettings(
      { alwaysOnTop: enabled },
      { throwOnError: true }
    ),
    broadcastSetting: enabled => {
      sendToWindow(panelWindow, 'always-on-top-changed', enabled);
    },
  });
}

// --- Window creation ---

function createPetWindow() {
  const saved = loadSettings();

  petWindow = new BrowserWindow({
    x: saved.petX,
    y: saved.petY,
    width: saved.petSize || saved.size || BASE_SIZE,
    height: saved.petSize || saved.size || BASE_SIZE,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: alwaysOnTopService
      ? alwaysOnTopService.getEnabled()
      : readAlwaysOnTopSetting(saved),
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
  if (alwaysOnTopService) alwaysOnTopService.attachWindow(petWindow);
  petWindow.webContents.once('did-finish-load', () => {
    if (eyeTrackingService) eyeTrackingService.setPetAvailable(true);
    sendToWindow(petWindow, 'test-mode-changed', testModeEnabled);
  });

  const savePetPos = debounce(() => {
    if (petWindow && !petWindow.isDestroyed()) {
      const [x, y] = petWindow.getPosition();
      saveSettings({ petX: x, petY: y });
    }
  }, 500);

  const savePetSize = debounce(() => {
    if (petWindow && !petWindow.isDestroyed()) {
      const { width } = petWindow.getBounds();
      saveSettings({ petSize: width });
    }
  }, 500);

  petWindow.on('move', savePetPos);
  petWindow.on('resize', savePetSize);

  petWindow.on('closed', () => {
    if (eyeTrackingService) eyeTrackingService.setPetAvailable(false);
    if (alwaysOnTopService) alwaysOnTopService.detachWindow(petWindow);
    petWindow = null;
  });

  petWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[pet] Render process gone:', details.reason);
    if (eyeTrackingService) eyeTrackingService.setPetAvailable(false);
    if (alwaysOnTopService && petWindow) alwaysOnTopService.detachWindow(petWindow);
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.destroy();
    }
    petWindow = null;
    setTimeout(() => {
      if (!app.isQuitting) createPetWindow();
    }, 1000);
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

// --- App lifecycle ---

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.focus();
    } else {
      createPanelWindow();
    }
  });
}

app.whenReady().then(() => {
  migrateSettings();
  testModeEnabled = readTestModeSetting();
  eyeTrackingService = createEyeTrackingService();
  alwaysOnTopService = createAlwaysOnTopService();
  createPetWindow();
  createTray();
}).catch(error => {
  console.error('[main] Startup failed:', error);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (eyeTrackingService) eyeTrackingService.destroy();
  if (tray && !tray.isDestroyed()) tray.destroy();
});

app.on('window-all-closed', () => {
  // 保留托盘运行，不退出
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPetWindow();
  }
});

// --- IPC: send channels ---

ipcMain.on('drag-pet', (event, dx, dy) => {
  if (petWindow && Number.isFinite(dx) && Number.isFinite(dy)) {
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

ipcMain.on('set-size', (event, size) => {
  if (petWindow && Number.isFinite(size) && size >= 64 && size <= 2048) {
    const [x, y] = petWindow.getPosition();
    const currentBounds = petWindow.getBounds();
    const centerX = x + currentBounds.width / 2;
    const centerY = y + currentBounds.height / 2;
    petWindow.setSize(size, size);
    petWindow.setPosition(
      Math.round(centerX - size / 2),
      Math.round(centerY - size / 2)
    );
    petWindow.webContents.send('apply-scale', size / BASE_SIZE);
    saveSettings({ petSize: size });
  }
});

// --- IPC: invoke channels ---

ipcMain.handle('get-test-mode', () => testModeEnabled);

ipcMain.handle('set-test-mode', (event, enabled) => {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('test mode state must be a boolean');
  }
  if (!eyeTrackingService) {
    throw new Error('test mode service is not ready');
  }
  if (enabled === testModeEnabled) return testModeEnabled;

  const previous = testModeEnabled;
  eyeTrackingService.setSuspended(enabled);
  try {
    saveSettings({ testMode: enabled }, { throwOnError: true });
  } catch (error) {
    eyeTrackingService.setSuspended(previous);
    throw error;
  }

  testModeEnabled = enabled;
  sendToWindow(petWindow, 'test-mode-changed', testModeEnabled);
  sendToWindow(panelWindow, 'test-mode-changed', testModeEnabled);
  return testModeEnabled;
});

ipcMain.handle('reset-pet-position', () => {
  if (!petWindow || petWindow.isDestroyed()) {
    throw new Error('pet window is not available');
  }

  const display = panelWindow && !panelWindow.isDestroyed()
    ? screen.getDisplayMatching(panelWindow.getBounds())
    : screen.getPrimaryDisplay();
  const position = centerWindowInWorkArea(
    petWindow.getBounds(),
    display.workArea
  );
  petWindow.setPosition(position.x, position.y);
  saveSettings({ petX: position.x, petY: position.y });
  return position;
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

ipcMain.handle('get-always-on-top', () => {
  return alwaysOnTopService
    ? alwaysOnTopService.getEnabled()
    : readAlwaysOnTopSetting(loadSettings());
});

ipcMain.handle('set-always-on-top', (event, enabled) => {
  if (!alwaysOnTopService) {
    throw new Error('Always-on-top service is not ready');
  }
  return alwaysOnTopService.setEnabled(enabled);
});

// --- IPC: i18n ---

ipcMain.on('set-locale', (event, localeCode) => {
  const dict = i18nService.setLocale(localeCode);
  if (dict) {
    if (petWindow) petWindow.webContents.send('locale-changed', localeCode, dict);
    if (panelWindow) panelWindow.webContents.send('locale-changed', localeCode, dict);
  }
});

ipcMain.handle('get-locales', () => i18nService.getLocales());
ipcMain.handle('get-locale-dict', (event, localeCode) => i18nService.getDict(localeCode));
ipcMain.handle('get-current-locale', () => i18nService.getCurrentLocale());

// --- IPC: external links & settings ---

ipcMain.handle('open-external', async (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
    await shell.openExternal(url);
  } catch (error) {
    console.warn('[open-external] Rejected URL:', url, error.message);
    throw error;
  }
});

ipcMain.handle('load-settings', () => loadSettings());

ipcMain.handle('save-settings', (event, partial) => {
  saveSettings(partial);
});
