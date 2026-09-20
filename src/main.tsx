import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from '@/app/App'
import { FirebaseGate } from '@/firebase/FirebaseGate'
import { queryClient } from '@/query/client'
import { AppThemeProvider } from '@/theme/ThemeProvider'
import { PrivacyProvider } from '@/privacy/PrivacyProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <PrivacyProvider>
          <FirebaseGate>
            <App />
          </FirebaseGate>
        </PrivacyProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
