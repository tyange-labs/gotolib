import { PersistQueryClientProvider } from '@tanstack/solid-query-persist-client'
import { render } from 'solid-js/web'
import { AppProvider } from './context/AppProvider.tsx'
import { persistOptions, queryClient } from './lib/queries.ts'
import { AppRouter } from './router.tsx'
import './index.css'
import './App.css'

render(
  () => (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </PersistQueryClientProvider>
  ),
  document.getElementById('root')!,
)
