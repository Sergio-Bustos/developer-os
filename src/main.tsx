import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ui-shell.css'
import './ui-dashboard.css'
import './ui-pages.css'
import './ui-github.css'
import App from './App.tsx'
import { initClickSound } from './lib/clickSound'

initClickSound()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
