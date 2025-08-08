import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TimezoneInfo, getUserTimezoneInfo } from '../lib/dateUtils';

interface TimezoneContextType {
  timezoneInfo: TimezoneInfo;
  setTimezone: (timezone: string) => void;
  refreshTimezone: () => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

interface TimezoneProviderProps {
  children: ReactNode;
}

/**
 * TimezoneProvider manages user timezone information globally
 * Automatically detects user timezone and provides utilities for timezone conversion
 */
export function TimezoneProvider({ children }: TimezoneProviderProps) {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo>(() => getUserTimezoneInfo());

  // Update timezone when user's system timezone changes
  const refreshTimezone = () => {
    const newTimezoneInfo = getUserTimezoneInfo();
    setTimezoneInfo(newTimezoneInfo);
  };

  // Allow manual timezone override (useful for testing or user preference)
  const setTimezone = (timezone: string) => {
    try {
      // Validate timezone by attempting to use it
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      
      const customTimezoneInfo = {
        ...getUserTimezoneInfo(),
        timeZone: timezone,
      };
      
      setTimezoneInfo(customTimezoneInfo);
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}`);
    }
  };

  // Listen for timezone changes (e.g., when user travels or changes system settings)
  useEffect(() => {
    const handleTimezoneChange = () => {
      refreshTimezone();
    };

    // Check timezone every 5 minutes in case user travels
    const interval = setInterval(refreshTimezone, 5 * 60 * 1000);
    
    // Listen for focus events in case timezone changed while app was in background
    window.addEventListener('focus', handleTimezoneChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleTimezoneChange);
    };
  }, []);

  const contextValue: TimezoneContextType = {
    timezoneInfo,
    setTimezone,
    refreshTimezone,
  };

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

/**
 * Hook to access timezone context
 * Provides timezone information and utilities
 */
export function useTimezone(): TimezoneContextType {
  const context = useContext(TimezoneContext);
  
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  
  return context;
}

/**
 * Higher-order component for components that need timezone awareness
 */
export function withTimezone<P extends object>(
  Component: React.ComponentType<P & { timezoneInfo: TimezoneInfo }>
) {
  return function TimezoneWrappedComponent(props: P) {
    const { timezoneInfo } = useTimezone();
    
    return <Component {...props} timezoneInfo={timezoneInfo} />;
  };
}