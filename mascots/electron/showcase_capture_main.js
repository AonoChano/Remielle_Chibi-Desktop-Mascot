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

const TOTAL_CAPTURE_PER_ANIM = 24;  // capture extra, then trim
const DISCARD_FIRST = 2;            // discard first N (switching artifact)
const DISCARD_LAST = 1;             // discard last N (next-anim flash)
const KEEP_PER_ANIM = TOTAL_CAPTURE_PER_ANIM - DISCARD_FIRST - DISCARD_LAST;
const FRAME_INTERVAL_MS = 80;
const SETTLE_MS = 800;
const CANVAS_SIZE = 400;

let captureWindow = null;
const FRAME_DIR = path.join(__dirname, 'showcase-frames-v2');
const doneFile = path.join(__dirname, 'showcase-done-v2.flag');

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
    transparent: false,
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

let globalFrame = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureLoop() {
  for (let i = 0; i < ANIMATIONS.length; i++) {
    const anim = ANIMATIONS[i];
    console.log(`\n[${i + 1}/${ANIMATIONS.length}] Capturing: ${anim.name} (${anim.label})`);

    captureWindow.webContents.send('play-animation', anim.name);
    await sleep(SETTLE_MS);

    let rawFrames = [];
    for (let f = 0; f < TOTAL_CAPTURE_PER_ANIM; f++) {
      if (!captureWindow) {
        console.error('Window lost!');
        fs.writeFileSync(doneFile, 'failed');
        app.quit();
        return;
      }
      try {
        const image = await captureWindow.webContents.capturePage();
        const filePath = path.join(FRAME_DIR, `tmp_${globalFrame}.png`);
        fs.writeFileSync(filePath, image.toPNG());
        rawFrames.push(filePath);
        globalFrame++;
        process.stdout.write(`\r  Capturing ${f + 1}/${TOTAL_CAPTURE_PER_ANIM}`);
      } catch (e) {
        console.error('\nCapture error:', e.message);
      }
      await sleep(FRAME_INTERVAL_MS);
    }

    // Trim: discard first and last frames
    const kept = rawFrames.slice(DISCARD_FIRST, rawFrames.length - DISCARD_LAST);
    // Rename to final names
    for (let k = 0; k < kept.length; k++) {
      const finalPath = path.join(FRAME_DIR, `${String(i).padStart(2, '0')}_${anim.name}_${String(k).padStart(3, '0')}.png`);
      fs.renameSync(kept[k], finalPath);
    }
    // Delete discarded frames
    for (let d = 0; d < DISCARD_FIRST; d++) {
      fs.unlinkSync(rawFrames[d]);
    }
    for (let d = 0; d < DISCARD_LAST; d++) {
      fs.unlinkSync(rawFrames[rawFrames.length - 1 - d]);
    }

    console.log(`\r  Kept ${kept.length}/${TOTAL_CAPTURE_PER_ANIM} frames`);
  }

  console.log(`\n\nDone! Total animations: ${ANIMATIONS.length}, frames each: ${KEEP_PER_ANIM}`);
  fs.writeFileSync(doneFile, JSON.stringify({
    animations: ANIMATIONS,
    framesPerAnim: KEEP_PER_ANIM
  }));
  app.quit();
}

ipcMain.on('capture-ready', () => {
  console.log('Spine loaded, starting showcase capture...');
  setTimeout(captureLoop, 500);
});

setTimeout(() => {
  if (!fs.existsSync(doneFile)) {
    console.log(`\nTimeout!`);
    fs.writeFileSync(doneFile, 'failed');
    app.quit();
  }
}, 180000);

app.whenReady().then(() => {
  console.log('Electron ready...');
  createCaptureWindow();
});

app.on('window-all-closed', () => { app.quit(); });
