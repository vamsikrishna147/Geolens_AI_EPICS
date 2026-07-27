import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { MissionProvider } from './context/MissionContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'

import { ThemeProvider } from './context/ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <MissionProvider>
          <App />
        </MissionProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)
