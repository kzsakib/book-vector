import { createRoot } from 'react-dom/client'
import App from './App'
import { useAtlas } from './store/atlas'
import './index.css'
import './styles/atlas.css'

if (import.meta.env.DEV) {
  // Handy for browser debugging and scripted checks during development.
  ;(window as unknown as { __atlas: typeof useAtlas }).__atlas = useAtlas
}

// No StrictMode: its double-mount would stream the dataset and spin up the
// worker twice in development.
createRoot(document.getElementById('root')!).render(<App />)
