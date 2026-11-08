import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// No StrictMode: its double-mount would stream the dataset and spin up the
// worker twice in development.
createRoot(document.getElementById('root')!).render(<App />)
