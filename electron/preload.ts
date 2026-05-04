import { ipcRenderer } from 'electron'

// Expose ipcRenderer to the window object for Vue
// @ts-ignore
window.ipcRenderer = ipcRenderer

// Provide a mechanism to stop the loading screen
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency] as string)
  }
})
