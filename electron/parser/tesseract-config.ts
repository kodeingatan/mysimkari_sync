import * as path from 'path'
import * as fs from 'fs'

export const TESS_LANGS = 'ind+eng'
export const TESS_FILES = ['ind.traineddata', 'eng.traineddata']

function getElectronApp(): { isPackaged?: boolean } | undefined {
  try {
    const req = (globalThis as unknown as { require?: unknown }).require
    if (typeof req === 'function') {
      const electron = (req as (id: string) => unknown)('electron') as {
        app?: { isPackaged?: boolean }
      }
      return electron?.app
    }
  } catch {
    // Not running inside Electron (e.g. unit tests) — ignore
  }
  return undefined
}

/** Folder containing *.traineddata — bin/ in dev, app resources when packaged. */
export function getTessDataDir(): string {
  const app = getElectronApp()
  const resourcesPath = (process as unknown as { resourcesPath?: string })
    .resourcesPath
  if (app?.isPackaged && resourcesPath) {
    return path.join(resourcesPath, 'bin')
  }
  return path.join(process.cwd(), 'bin')
}

export function hasLocalTessData(dir?: string): boolean {
  const d = dir ?? getTessDataDir()
  return TESS_FILES.every((f) => fs.existsSync(path.join(d, f)))
}

/**
 * Options for Tesseract.createWorker so it reads *.traineddata from local
 * bin/ instead of downloading from CDN (fully offline OCR).
 * cacheMethod 'none' prevents tesseract from writing duplicate copies of the
 * traineddata files into the working directory on every run.
 * Falls back to defaults (CDN) when the files are missing.
 */
export function getTesseractOptions(): {
  langPath: string;
  gzip: boolean;
  cacheMethod: string;
} | Record<string, never> {
  const dir = getTessDataDir()
  if (!hasLocalTessData(dir)) return {}
  return { langPath: dir, gzip: false, cacheMethod: "none" }
}
