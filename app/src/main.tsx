import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadLang } from './lib/i18n'

// сначала язык (английский словарь — отдельным файлом), потом приложение: его тексты собираются при загрузке модулей
loadLang().catch(() => {}).then(() => import('./App.tsx')).then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
