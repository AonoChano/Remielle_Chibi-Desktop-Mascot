const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Animation list with label and internal name
const ANIMATIONS = [
  { name: 'a',     label: 'idle' },
  { name: 'b',     label: 'thinking' },
  { name: 'd',     label: 'drawing' },
  { name: 'c',     label: 'finished' },
  { name: 'd_win', label: 'done' },
  { name: 'e',     label: 'tearing_up' },
  { name: 'a_win', label: 'ready' },
  { name: 'light', label: 'golden_light' },
];

const FRAMES_PER_ANIM = 20;
const FRAME_INTERVAL_MS = 80;
const SETTLE_MS = 600; // wait for animation to settle after switching
const CANVAS_SIZE = 400;

let captureWindow = null;
const FRAME_DIR = path.join(__dirname, 'showcase-frames');
const doneFile = path.join(__dirname, 'showcase-done.flag');

// Cleanup
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
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    show: false,
    frame: false,
    backgroundColor: '#ff00ff',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false
    }
  });

  captureWindow.loadFile('showcase_capture.html');
  captureWindow.webContents.on('console-message', (e, level, msg) => {
    console.log('[renderer]', msg);
  });
  captureWindow.on('closed', () => { captureWindow = null; });
}

let currentAnimIdx = 0;
let frameInAnim = 0;
let globalFrame = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureLoop() {
  for (let i = 0; i < ANIMATIONS.length; i++) {
    const anim = ANIMATIONS[i];
    console.log(`\n[${i + 1}/${ANIMATIONS.length}] Capturing: ${anim.name} (${anim.label})`);

    // Tell renderer to switch animation
    captureWindow.webContents.send('play-animation', anim.name);
    await sleep(SETTLE_MS);

    for (let f = 0; f < FRAMES_PER_ANIM; f++) {
      if (!captureWindow) {
        console.error('Window lost!');
        fs.writeFileSync(doneFile, 'failed');
        app.quit();
        return;
      }
      try {
        const image = await captureWindow.webContents.capturePage();
        const filePath = path.join(FRAME_DIR, `${String(globalFrame).padStart(5, '0')}_${anim.name}_${String(f).padStart(3, '0')}.png`);
        fs.writeFileSync(filePath, image.toPNG());
        globalFrame++;
        process.stdout.write(`\r  Frame ${f + 1}/${FRAMES_PER_ANIM}`);
      } catch (e) {
        console.error('\nCapture error:', e.message);
      }
      await sleep(FRAME_INTERVAL_MS);
    }
  }

  console.log(`\n\nDone! Total frames: ${globalFrame}`);
  fs.writeFileSync(doneFile, JSON.stringify({
    totalFrames: globalFrame,
    animations: ANIMATIONS,
    framesPerAnim: FRAMES_PER_ANIM
  }));
  app.quit();
}

ipcMain.on('capture-ready', () => {
  console.log('Spine loaded, starting showcase capture...');
  setTimeout(captureLoop, 500);
});

setTimeout(() => {
  if (!fs.existsSync(doneFile)) {
    console.log(`\nTimeout! Got ${globalFrame} frames.`);
    fs.writeFileSync(doneFile, globalFrame > 0 ? 'partial' : 'failed');
    app.quit();
  }
}, 180000);

app.whenReady().then(() => {
  console.log('Electron ready...');
  createCaptureWindow();
});

app.on('window-all-closed', () => { app.quit(); });
