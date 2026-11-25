import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import id from './id.js'
import en from './en.js'
import { formatDate, formatNumber, formatScore, interpolate } from '../lib/utils.js'

const DICTIONARIES = { id, en }
const STORAGE_KEY = 'gigly.lang'

const I18nContext = createContext(null)

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'id' || saved === 'en') return saved
  } catch {
    /* storage can be blocked; fall through */
  }
  return 'id'
}

const lookup = (dict, path) => path.split('.').reduce((node, key) => node?.[key], dict)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(() => {
    const dict = DICTIONARIES[lang]
    /** t('rec.count', { n: 3 }). Arrays and objects are returned as-is. */
    const t = (path, params) => {
      const found = lookup(dict, path)
      if (found === undefined) return path
      return typeof found === 'string' ? interpolate(found, params) : found
    }
    return {
      lang,
      setLang,
      t,
      number: (n, opts) => formatNumber(n, lang, opts),
      score: (n) => formatScore(n, lang),
      date: (iso) => formatDate(iso, lang),
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/** Pick the active language from a { id, en } object, or return plain strings untouched. */
export function useLocalized() {
  const { lang } = useI18n()
  return (value) => (value && typeof value === 'object' ? (value[lang] ?? value.en) : value)
}
