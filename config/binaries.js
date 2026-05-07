const path = require('path');

/**
 * Configuration for all external binaries required by the project.
 * Each binary definition includes its name, executable names, download URL, 
 * and logic for determining its local path.
 */
module.exports = {
  ghostscript: {
    id: 'ghostscript',
    name: 'Ghostscript',
    exe64: 'gswin64c.exe',
    exe32: 'gswin32c.exe',
    downloadUrl: 'https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10070/gs10070w64.exe',
    // Path relative to project root where the binaries are extracted/installed
    getBinPath: (projectRoot) => path.join(projectRoot, 'bin', 'gs', 'bin'),
    // Installation command (silent)
    getInstallCmd: (installerPath, projectRoot) => {
      const targetPath = path.join(projectRoot, 'bin', 'gs');
      // For NSIS installers, /S is silent and /D specifies the output directory
      return `"${installerPath}" /S /D=${targetPath}`;
    }
  }
};
