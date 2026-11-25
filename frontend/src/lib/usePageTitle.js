import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Rekomendasi freelancer · Gigly". */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Gigly` : 'Gigly'
  }, [title])
}
