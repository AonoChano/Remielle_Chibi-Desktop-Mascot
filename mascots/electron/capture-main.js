const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let captureWindow = null;
const TOTAL_FRAMES = 60;
const FRAME_INTERVAL_MS = 50;
const FRAME_DIR = path.join(__dirname, 'capture-frames');
const doneFile = path.join(__dirname, 'capture-done.flag');

if (fs.existsSync(FRAME_DIR)) fs.rmSync(FRAME_DIR, { recursive: true });
fs.mkdirSync(FRAME_DIR, { recursive: true });
if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function createCaptureWindow() {
  captureWindow = new BrowserWindow({
    width: 400,
    height: 400,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false
    }
  });

  captureWindow.loadFile('capture.html');
  captureWindow.webContents.on('console-message', (e, level, msg) => {
    console.log('[renderer]', msg);
  });
  captureWindow.on('closed', () => { captureWindow = null; });
}

let frameCount = 0;

async function captureFrame() {
  if (frameCount >= TOTAL_FRAMES || !captureWindow) {
    console.log('\nDone! Total frames:', frameCount);
    fs.writeFileSync(doneFile, 'done');
    app.quit();
    return;
  }
  try {
    const image = await captureWindow.webContents.capturePage();
    const filePath = path.join(FRAME_DIR, `frame_${String(frameCount).padStart(4, '0')}.png`);
    fs.writeFileSync(filePath, image.toPNG());
    frameCount++;
    process.stdout.write(`\rFrame ${frameCount}/${TOTAL_FRAMES}`);
  } catch (e) {
    console.error('\nCapture error:', e.message);
  }
  setTimeout(captureFrame, FRAME_INTERVAL_MS);
}

ipcMain.on('capture-ready', () => {
  console.log('Spine loaded, starting capture...');
  setTimeout(captureFrame, 500);
});

setTimeout(() => {
  if (frameCount < TOTAL_FRAMES) {
    console.log(`\nTimeout: got ${frameCount} frames.`);
    fs.writeFileSync(doneFile, frameCount > 0 ? 'partial' : 'failed');
    app.quit();
  }
}, 120000);

app.whenReady().then(() => {
  console.log('Electron ready...');
  createCaptureWindow();
});

app.on('window-all-closed', () => { app.quit(); });
