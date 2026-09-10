import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// registerType: 'autoUpdate' já troca o SW e recarrega os assets sem prompt
// ao usuário; immediate garante que o SW seja registrado assim que possível
// (sem esperar o evento `load`).
registerSW({ immediate: true })
