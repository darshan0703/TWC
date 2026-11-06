import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { KioskProvider } from './context/KioskContext'
import { VoiceBaristaProvider } from './context/VoiceBaristaContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <KioskProvider>
        <VoiceBaristaProvider>
          <App />
        </VoiceBaristaProvider>
      </KioskProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

