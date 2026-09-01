import { render } from 'solid-js/web'
import { AppProvider } from './context/AppProvider.tsx'
import { AppRouter } from './router.tsx'
import './index.css'
import './App.css'

render(
  () => (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  ),
  document.getElementById('root')!,
)
