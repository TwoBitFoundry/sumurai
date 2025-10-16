import React, { useEffect, useState, useCallback } from 'react'
import { AuthService } from './services/authService'
import { GlassCard, Button } from './ui/primitives'

const SESSION_WARNING_THRESHOLD = 120 // 2 minutes in seconds
const SESSION_CHECK_INTERVAL = 1000 // 1 second

interface SessionExpiryModalProps {
  isOpen: boolean
  timeRemaining: number
  onStayLoggedIn: () => void
  onLogout: () => void
}

export function SessionExpiryModal({ 
  isOpen, 
  timeRemaining, 
  onStayLoggedIn, 
  onLogout 
}: SessionExpiryModalProps) {
  if (!isOpen) return null
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  const handleStayLoggedIn = async () => {
    try {
      const success = await refreshUserSession()
      if (success) {
        onStayLoggedIn()
      } else {
        handleSessionExpired()
      }
    } catch (error) {
      console.error('Session refresh failed:', error)
      handleSessionExpired()
    }
  }

  const refreshUserSession = async (): Promise<boolean> => {
    try {
      const result = await AuthService.refreshToken()
      if (result?.token) {
        sessionStorage.setItem('auth_token', result.token)
        return true
      }
    } catch (_error) {
      // fall-through to false
    }
    return false
  }
  
  const handleSessionExpired = () => {
    sessionStorage.clear()
    onLogout()
  }
  
  const handleLogout = () => {
    sessionStorage.clear()
    onLogout()
  }
  
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" aria-hidden />
      <div className="relative z-10 grid h-full place-items-center">
        <div className="px-4">
          <GlassCard
            variant="accent"
            rounded="xl"
            padding="lg"
            withInnerEffects={false}
            containerClassName="w-full max-w-md"
            className="text-center"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Session expiring
            </h2>
            <div className="mt-4 text-3xl font-mono text-red-600 dark:text-red-400">
              {formatTime(timeRemaining)}
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Your session will expire in {Math.ceil(timeRemaining / 60)} minutes.
            </p>
            <div className="mt-6 space-y-3">
              <Button
                type="button"
                onClick={handleStayLoggedIn}
                className="w-full"
                size="lg"
              >
                Stay logged in
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleLogout}
                className="w-full"
                size="lg"
              >
                Logout now
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Do nothing to auto-logout when the timer reaches zero.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

interface SessionManagerProps {
  children: React.ReactNode
  onLogout: () => void
}

const parseJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = atob(base64)
    return JSON.parse(jsonPayload)
  } catch (error) {
    return null
  }
}

const getTokenExpiryTime = (token: string): number | null => {
  const payload = parseJWT(token)
  return payload?.exp || null
}

const isTokenExpired = (token: string): boolean => {
  const expiry = getTokenExpiryTime(token)
  if (!expiry) return true
  return Math.floor(Date.now() / 1000) >= expiry
}

const getTimeUntilExpiry = (token: string): number => {
  const expiry = getTokenExpiryTime(token)
  if (!expiry) return 0
  return Math.max(0, expiry - Math.floor(Date.now() / 1000))
}

export function SessionManager({ children, onLogout }: SessionManagerProps) {
  const [showExpiryModal, setShowExpiryModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  
  const checkSessionExpiry = useCallback(() => {
    const token = sessionStorage.getItem('auth_token')
    if (!token) {
      onLogout()
      return
    }
    
    if (isTokenExpired(token)) {
      sessionStorage.clear()
      onLogout()
      return
    }
    
    const timeUntilExpiry = getTimeUntilExpiry(token)
    
    if (timeUntilExpiry <= SESSION_WARNING_THRESHOLD && timeUntilExpiry > 0) {
      setTimeRemaining(timeUntilExpiry)
      setShowExpiryModal(true)
    }
  }, [onLogout])
  
  useEffect(() => {
    checkSessionExpiry()
    const interval = setInterval(checkSessionExpiry, SESSION_CHECK_INTERVAL)
    
    return () => clearInterval(interval)
  }, [checkSessionExpiry])
  
  useEffect(() => {
    if (!showExpiryModal || timeRemaining <= 0) return
    
    const timer = setTimeout(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1
        if (newTime <= 0) {
          sessionStorage.clear()
          onLogout()
          return 0
        }
        return newTime
      })
    }, SESSION_CHECK_INTERVAL)
    
    return () => clearTimeout(timer)
  }, [timeRemaining, showExpiryModal, onLogout])
  
  const handleStayLoggedIn = () => {
    setShowExpiryModal(false)
    setTimeRemaining(0)
  }
  
  const handleLogout = () => {
    setShowExpiryModal(false)
    onLogout()
  }
  
  return (
    <>
      {children}
      <SessionExpiryModal 
        isOpen={showExpiryModal}
        timeRemaining={timeRemaining}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />
    </>
  )
}
