'use client'

import { useEffect, useCallback, useRef } from 'react'
import { signOut } from 'next-auth/react'

const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function InactivityTimeout() {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      signOut({ callbackUrl: '/login?reason=timeout' })
    }, TIMEOUT_MS)
  }, [])

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return null
}
