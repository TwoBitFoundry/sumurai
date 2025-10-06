import React, { useEffect, useState, useCallback } from 'react'
import { AuthService } from './services/authService'

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
    } catch (_) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-md rounded-[2.25rem] bg-white p-6 shadow-xl transition-colors duration-300 dark:bg-slate-800">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Session Expiring
          </h2>
          <div className="text-3xl font-mono text-red-600 dark:text-red-400 mb-4">
            {formatTime(timeRemaining)}
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Your session will expire in {Math.ceil(timeRemaining / 60)} minutes. 
            What would you like to do?
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={handleStayLoggedIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Stay Logged In
            </button>
            
            <button 
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Logout
            </button>
            
            <div className="text-sm text-slate-500 dark:text-slate-400">
              <p>Do nothing - automatically log out when time reaches zero</p>
            </div>
          </div>
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
