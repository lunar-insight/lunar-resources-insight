import React, { createContext, useContext } from 'react';
import * as Cesium from 'cesium';

interface ViewerContextType {
  viewer: Cesium.CesiumWidget | null;
  setViewer: (viewer: Cesium.CesiumWidget) => void;
}

const ViewerContext = createContext<ViewerContextType | undefined>(undefined);

export const ViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewer, setViewer] = React.useState<Cesium.CesiumWidget | null>(null);
  const value = React.useMemo(() => ({ viewer, setViewer }), [viewer]);

  return (
    <ViewerContext.Provider value={value}>
      {children}
    </ViewerContext.Provider>
  );
};

export const useViewer = () => {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error('useViewer must be used within a ViewerProvider');
  }
  return context;
}