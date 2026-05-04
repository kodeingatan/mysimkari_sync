import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')

// Post-message handling for Electron renderer
postMessage({ payload: 'removeLoading' }, '*')
