import React, { createContext, useContext } from 'react';

const BoundaryRefContext = createContext<React.RefObject<HTMLDivElement> | null>(null);

export const useBoundaryRef = () => {
  const context = useContext(BoundaryRefContext);
  if (!context) {
    throw new Error('useBoundaryRef must be used within a BoundaryRefProvider');
  }
  return context;
}

export const BoundaryRefProvider: React.FC<{ value: React.RefObject<HTMLDivElement>; children: React.ReactNode }> = ({ value, children }) => {
  return (
    <BoundaryRefContext.Provider value={value}>
      {children}
    </BoundaryRefContext.Provider>
  );
};