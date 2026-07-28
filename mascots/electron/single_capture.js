const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Electron injects its own flags into argv, so find the script path first
const scriptIdx = process.argv.findIndex(a => a.endsWith('single_capture.js'));
const ANIM_NAME = process.argv[scriptIdx + 1];
if (!ANIM_NAME) {
  console.error('Usage: electron single_capture.js <animation_name>');
  console.error('argv:', JSON.stringify(process.argv));
  process.exit(1);
}

const TOTAL_FRAMES = 20;
const FRAME_INTERVAL_MS = 80;
const SETTLE_MS = 600;
const CANVAS_SIZE = 400;

let captureWindow = null;
const FRAME_DIR = path.join(__dirname, 'single-frames', ANIM_NAME);
const doneFile = path.join(FRAME_DIR, 'done.flag');

if (fs.existsSync(FRAME_DIR)) fs.rmSync(FRAME_DIR, { recursive: true });
fs.mkdirSync(FRAME_DIR, { recursive: true });

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function createCaptureWindow() {
  captureWindow = new BrowserWindow({
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
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

  captureWindow.loadFile('single_capture.html');
  captureWindow.webContents.on('console-message', (e, level, msg) => {
    console.log('[renderer]', msg);
  });
  captureWindow.on('closed', () => { captureWindow = null; });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureFrames() {
  console.log(`Animation: ${ANIM_NAME}, settling ${SETTLE_MS}ms...`);
  await sleep(SETTLE_MS);

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    if (!captureWindow) {
      console.error('Window lost!');
      process.exit(1);
    }
    try {
      const image = await captureWindow.webContents.capturePage();
      const filePath = path.join(FRAME_DIR, `frame_${String(f).padStart(4, '0')}.png`);
      fs.writeFileSync(filePath, image.toPNG());
      process.stdout.write(`\rFrame ${f + 1}/${TOTAL_FRAMES}`);
    } catch (e) {
      console.error('\nCapture error:', e.message);
    }
    await sleep(FRAME_INTERVAL_MS);
  }

  console.log(`\nDone! ${TOTAL_FRAMES} frames`);
  fs.writeFileSync(doneFile, 'done');
  app.quit();
}

ipcMain.on('capture-ready', () => {
  // Send animation name to renderer
  captureWindow.webContents.send('set-animation', ANIM_NAME);
  console.log('Spine loaded, capturing animation:', ANIM_NAME);
  setTimeout(captureFrames, 300);
});

app.whenReady().then(() => {
  createCaptureWindow();
});

app.on('window-all-closed', () => { app.quit(); });
