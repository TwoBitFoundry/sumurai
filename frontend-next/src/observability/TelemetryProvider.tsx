import React, { useEffect, useRef, useState } from 'react';
import { Span } from '@opentelemetry/api';
import type { ITelemetryService } from './TelemetryService';

export interface TelemetryContextValue {
  service: ITelemetryService;
  activeSpan: Span | undefined;
  setActiveSpan: (span: Span | undefined) => void;
}

export const TelemetryContext = React.createContext<TelemetryContextValue | null>(null);

interface TelemetryProviderProps {
  children: React.ReactNode;
  service: ITelemetryService;
}

export function TelemetryProvider({ children, service }: TelemetryProviderProps) {
  const [activeSpan, setActiveSpan] = useState<Span | undefined>();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      await service.initialize();
    };

    initialize();

    return () => {
      service.shutdown();
    };
  }, [service]);

  const value: TelemetryContextValue = {
    service,
    activeSpan,
    setActiveSpan,
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}
