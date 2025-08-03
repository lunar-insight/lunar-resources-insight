import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface ZIndexContextValue {
  bringToFront: (id: string, type: 'content-container' | 'box-container' | 'modal') => void;
  getZIndex: (id: string, type: 'content-container' | 'box-container' | 'modal') => number;
  registerModal: (id: string) => void;
  unregisterModal: (id: string) => void;
}

const ZIndexContext = createContext<ZIndexContextValue | undefined>(undefined);

export const useZIndex = () => {
  const context = useContext(ZIndexContext);
  if (!context) {
    throw new Error('useZIndex must be used within a ZIndexProvider');
  }
  return context;
};

interface ZIndexItem {
  id: string;
  type: 'content-container' | 'box-container' | 'modal';
  order: number;
}

export const ZIndexProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ZIndexItem[]>([]);
  const [activeModals, setActiveModals] = useState<Set<string>>(new Set());
  const orderCounterRef = useRef(0);

  const bringToFront = useCallback((id: string, type: 'content-container' | 'box-container' | 'modal') => {
    setItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      orderCounterRef.current += 1;
      const newItems = [...filtered, { id, type, order: orderCounterRef.current }];
      return newItems;
    });
  }, []);

  const getZIndex = useCallback((id: string, type: 'content-container' | 'box-container' | 'modal'): number => {
    const item = items.find(item => item.id === id);
    const baseZIndex = getBaseZIndex(type);
    
    // If modals are active, every other elements goes behind
    if (activeModals.size > 0 && (type === 'content-container' || type === 'box-container')) {
      return baseZIndex - 100;
    }
    
    const finalZIndex = baseZIndex + (item?.order || 0);
    return finalZIndex;
  }, [items, activeModals]);

  const registerModal = useCallback((id: string) => {
    setActiveModals(prev => {
      if (prev.has(id)) return prev;
      return new Set([...prev, id]);
    });
    bringToFront(id, 'modal');
  }, [bringToFront]);

  const unregisterModal = useCallback((id: string) => {
    setActiveModals(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  return (
    <ZIndexContext.Provider value={{ bringToFront, getZIndex, registerModal, unregisterModal }}>
      {children}
    </ZIndexContext.Provider>
  );
};

const getBaseZIndex = (type: 'content-container' | 'box-container' | 'modal'): number => {
  switch (type) {
    case 'content-container':
    case 'box-container':
      return 100;
    case 'modal':
      return 1000;
    default:
      return 100;
  }
};