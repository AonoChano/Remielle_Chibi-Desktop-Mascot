const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let petWindow = null;
let panelWindow = null;
let tray = null;

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 420,
    height: 420,
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

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function createPanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.focus();
    return;
  }
  panelWindow = new BrowserWindow({
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
  createPetWindow();
  createTray();
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

ipcMain.on('set-outfit', (event, prefix) => {
  if (petWindow) {
    petWindow.webContents.send('set-outfit', prefix);
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
  }
});

// --- i18n ---
let currentLocale = 'zh-CN';

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
    const dict = localeCache[localeCode];
    if (petWindow) petWindow.webContents.send('locale-changed', localeCode, dict);
    if (panelWindow) panelWindow.webContents.send('locale-changed', localeCode, dict);
  }
});

ipcMain.handle('get-current-locale', () => {
  return currentLocale;
});
