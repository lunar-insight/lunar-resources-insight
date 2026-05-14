import React, { createContext, useContext, useState } from 'react';

interface ScannerContextValue {
  showElementScanner: boolean;
  toggleElementScanner: (val: boolean) => void;
  showCompoundScanner: boolean;
  toggleCompoundScanner: (val: boolean) => void;
  showDerivedIndexScanner: boolean;
  toggleDerivedIndexScanner: (val: boolean) => void;
  anyScannerOpen: boolean;
}

const ScannerContext = createContext<ScannerContextValue | undefined>(undefined);

export const useScannerContext = () => {
  const context = useContext(ScannerContext);
  if (!context) {
    throw new Error('useScannerContext must be used within a ScannerProvider');
  }
  return context;
};

export const ScannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showElementScanner, setShowElementScanner] = useState(false);
  const [showCompoundScanner, setShowCompoundScanner] = useState(false);
  const [showDerivedIndexScanner, setShowDerivedIndexScanner] = useState(false);

  const anyScannerOpen = showElementScanner || showCompoundScanner || showDerivedIndexScanner;

  return (
    <ScannerContext.Provider value={{
      showElementScanner,
      toggleElementScanner: setShowElementScanner,
      showCompoundScanner,
      toggleCompoundScanner: setShowCompoundScanner,
      showDerivedIndexScanner,
      toggleDerivedIndexScanner: setShowDerivedIndexScanner,
      anyScannerOpen,
    }}>
      {children}
    </ScannerContext.Provider>
  );
};
