const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');

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
    icon: path.join(__dirname, 'assets', 'leimi.png'),
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
  const iconPath = path.join(__dirname, 'assets', 'leimi.png');
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
