import { useState } from 'react'
import './App.css'

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')
  const toggle = () => {
    const next = lang === 'en' ? 'bn' : 'en'
    localStorage.setItem('lang', next)
    setLang(next)
  }
  return (
    <div className="app" lang={lang}>
      <header className="topbar">
        <h1>{lang === 'en' ? 'Tender Package Builder' : 'টেন্ডার প্যাকেজ নির্মাতা'}</h1>
        <button onClick={toggle}>{lang === 'en' ? 'বাংলা' : 'English'}</button>
      </header>
    </div>
  )
}
