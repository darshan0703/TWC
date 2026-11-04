import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { KioskProvider } from './context/KioskContext'
import { VoiceBaristaProvider } from './context/VoiceBaristaContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <KioskProvider>
      <VoiceBaristaProvider>
        <App />
      </VoiceBaristaProvider>
    </KioskProvider>
  </React.StrictMode>,
)

