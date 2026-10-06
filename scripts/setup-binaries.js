const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const binariesConfig = require('../config/binaries');

const PROJECT_ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(PROJECT_ROOT, 'bin');

// Tesseract language data (LSTM) for offline OCR. Downloaded once into bin/.
const TESSDATA_URLS = {
  eng: 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata',
  ind: 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/ind.traineddata',
};

/**
 * Downloads a file using PowerShell's Invoke-WebRequest (reliable on Windows).
 */
function downloadFile(url, dest) {
  console.log(`Downloading from ${url}...`);
  const cmd = `powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${dest}'"`;
  execSync(cmd, { stdio: 'inherit' });
}

/**
 * Main setup function to check and download missing binaries.
 */
async function setup() {
  console.log('--- Checking Project Binaries ---');
  
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR);
  }

  for (const key in binariesConfig) {
    const bin = binariesConfig[key];
    const binDir = bin.getBinPath(PROJECT_ROOT);
    const exePath = path.join(binDir, bin.exe64);

    if (!fs.existsSync(exePath)) {
      console.log(`[MISSING] ${bin.name} not found at ${exePath}`);
      
      const installerName = `installer_${bin.id}.exe`;
      const installerPath = path.join(BIN_DIR, installerName);

      try {
        downloadFile(bin.downloadUrl, installerPath);
        
        console.log(`[INSTALLING] Running silent installation for ${bin.name}...`);
        
        const targetPath = path.join(PROJECT_ROOT, 'bin', bin.id);
        execSync(`powershell -Command "Start-Process -FilePath '${installerPath}' -ArgumentList '/S', '/D=${targetPath}' -Wait"`, { stdio: 'inherit' });
        
        console.log(`[SUCCESS] ${bin.name} installed successfully.`);
        
        // Clean up installer
        if (fs.existsSync(installerPath)) {
          fs.unlinkSync(installerPath);
        }
      } catch (err) {
        console.error(`[ERROR] Failed to setup ${bin.name}:`, err.message);
      }
    } else {
      console.log(`[OK] ${bin.name} is available.`);
    }
  }

  // Tesseract traineddata (bin/ is gitignored, so re-download if missing)
  for (const [lang, url] of Object.entries(TESSDATA_URLS)) {
    const dest = path.join(BIN_DIR, `${lang}.traineddata`);
    if (fs.existsSync(dest)) {
      console.log(`[OK] tessdata ${lang} is available.`);
    } else {
      console.log(`[MISSING] tessdata ${lang} not found at ${dest}`);
      try {
        downloadFile(url, dest);
        console.log(`[SUCCESS] tessdata ${lang} downloaded.`);
      } catch (err) {
        console.error(`[ERROR] Failed to download tessdata ${lang}:`, err.message);
      }
    }
  }
  
  console.log('--- Binary Check Complete ---\n');
}

setup();
