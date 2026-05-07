import { join } from 'path';
import * as fs from 'fs';
import { app } from 'electron';

// Import the common JS config
// @ts-ignore
const binariesConfig = require('../config/binaries');

/**
 * Manages external binaries for the Electron application.
 * Centralizes the logic for locating executables either in the local 'bin' directory
 * or in common system installation paths.
 */
export function getBinaryPath(id: string): string {
  const bin = binariesConfig[id];
  if (!bin) {
    throw new Error(`Binary configuration not found for: ${id}`);
  }

  // In development, we use process.cwd() (project root)
  // In production, we should adjust this based on the app path
  const projectRoot = app.isPackaged 
    ? join(process.resourcesPath, 'app.asar.unpacked') 
    : process.cwd();

  // 1. Check local 'bin' folder (populated by setup-binaries script)
  const localBinDir = bin.getBinPath(projectRoot);
  const local64 = join(localBinDir, bin.exe64);
  const local32 = join(localBinDir, bin.exe32);
  
  if (fs.existsSync(local64)) return local64;
  if (fs.existsSync(local32)) return local32;

  // 2. Fallback to system-specific paths (Legacy behavior for robustness)
  if (id === 'ghostscript') {
    const progFiles = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']];
    for (const pf of progFiles) {
      if (!pf) continue;
      const gsDir = join(pf, 'gs');
      if (fs.existsSync(gsDir)) {
        try {
          const versions = fs.readdirSync(gsDir);
          for (const ver of versions) {
            const b64 = join(gsDir, ver, 'bin', bin.exe64);
            const b32 = join(gsDir, ver, 'bin', bin.exe32);
            if (fs.existsSync(b64)) return b64;
            if (fs.existsSync(b32)) return b32;
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    }
  }

  // 3. Last resort: fallback to the executable name (assuming it's in system PATH)
  return bin.exe64;
}
