import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/ui/primitives';
import { AuthService } from './services/authService';
import { Button, GlassCard, Modal } from './ui/primitives';

const SESSION_WARNING_THRESHOLD = 120; // 2 minutes in seconds
const SESSION_CHECK_INTERVAL = 1000; // 1 second

interface SessionExpiryModalProps {
  isOpen: boolean;
  timeRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  onSessionRefreshed?: (expiresAt: string) => void;
}

export function SessionExpiryModal({
  isOpen,
  timeRemaining,
  onStayLoggedIn,
  onLogout,
  onSessionRefreshed,
}: SessionExpiryModalProps) {
  if (!isOpen) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStayLoggedIn = async () => {
    try {
      const success = await refreshUserSession();
      if (success) {
        onStayLoggedIn();
      } else {
        handleSessionExpired();
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      handleSessionExpired();
    }
  };

  const refreshUserSession = async (): Promise<boolean> => {
    try {
      const result = await AuthService.refreshToken();
      if (result?.expires_at) {
        onSessionRefreshed?.(result.expires_at);
        return true;
      }
    } catch {
      // fall-through to false
    }
    return false;
  };

  const handleSessionExpired = () => {
    AuthService.clearToken();
    onLogout();
  };

  const handleLogout = () => {
    AuthService.clearToken();
    onLogout();
  };

  return (
    <Modal
      isOpen
      onClose={handleLogout}
      preventCloseOnBackdrop
      labelledBy="session-expiry-heading"
      size="sm"
    >
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className={cn('space-y-5', 'text-center')}
      >
        <div className="space-y-2">
          <h2
            id="session-expiry-heading"
            className={cn('text-xl', 'font-semibold', 'text-slate-900', 'dark:text-slate-100')}
          >
            Session expiring
          </h2>
          <div className={cn('text-3xl', 'font-mono', 'text-red-600', 'dark:text-red-400')}>
            {formatTime(timeRemaining)}
          </div>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-400')}>
            Your session will expire in {Math.ceil(timeRemaining / 60)} minutes.
          </p>
        </div>

        <div className="space-y-3">
          <Button type="button" onClick={handleStayLoggedIn} className="w-full" size="lg">
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
          <p className={cn('text-xs', 'text-slate-500', 'dark:text-slate-400')}>
            Do nothing to auto-logout when the timer reaches zero.
          </p>
        </div>
      </GlassCard>
    </Modal>
  );
}

interface SessionManagerProps {
  children: React.ReactNode;
  expiresAt: string | null;
  onSessionRefreshed: (expiresAt: string) => void;
  onLogout: () => void;
}

const parseExpiry = (expiresAt: string) => {
  try {
    return Math.floor(new Date(expiresAt).getTime() / 1000);
  } catch {
    return null;
  }
};

const getTokenExpiryTime = (expiresAt: string): number | null => {
  return parseExpiry(expiresAt);
};

const isTokenExpired = (expiresAt: string): boolean => {
  const expiry = getTokenExpiryTime(expiresAt);
  if (!expiry) return true;
  return Math.floor(Date.now() / 1000) >= expiry;
};

const getTimeUntilExpiry = (expiresAt: string): number => {
  const expiry = getTokenExpiryTime(expiresAt);
  if (!expiry) return 0;
  return Math.max(0, expiry - Math.floor(Date.now() / 1000));
};

export function SessionManager({
  children,
  expiresAt,
  onSessionRefreshed,
  onLogout,
}: SessionManagerProps) {
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const checkSessionExpiry = useCallback(() => {
    if (!expiresAt) {
      return;
    }

    if (isTokenExpired(expiresAt)) {
      AuthService.clearToken();
      onLogout();
      return;
    }

    const timeUntilExpiry = getTimeUntilExpiry(expiresAt);

    if (timeUntilExpiry <= SESSION_WARNING_THRESHOLD && timeUntilExpiry > 0) {
      setTimeRemaining(timeUntilExpiry);
      setShowExpiryModal(true);
    }
  }, [expiresAt, onLogout]);

  useEffect(() => {
    if (!expiresAt) {
      setShowExpiryModal(false);
      setTimeRemaining(0);
      return;
    }

    checkSessionExpiry();
    const interval = setInterval(checkSessionExpiry, SESSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkSessionExpiry, expiresAt]);

  useEffect(() => {
    if (!showExpiryModal || timeRemaining <= 0) return;

    const timer = setTimeout(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          AuthService.clearToken();
          onLogout();
          return 0;
        }
        return newTime;
      });
    }, SESSION_CHECK_INTERVAL);

    return () => clearTimeout(timer);
  }, [timeRemaining, showExpiryModal, onLogout]);

  const handleStayLoggedIn = () => {
    setShowExpiryModal(false);
    setTimeRemaining(0);
  };

  const handleLogout = () => {
    setShowExpiryModal(false);
    AuthService.clearToken();
    onLogout();
  };

  return (
    <>
      {children}
      <SessionExpiryModal
        isOpen={showExpiryModal}
        timeRemaining={timeRemaining}
        onStayLoggedIn={handleStayLoggedIn}
        onSessionRefreshed={onSessionRefreshed}
        onLogout={handleLogout}
      />
    </>
  );
}
