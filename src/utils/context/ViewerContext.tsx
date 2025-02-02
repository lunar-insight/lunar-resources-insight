import React, { createContext, useContext } from 'react';
import * as Cesium from 'cesium';

interface ViewerContextType {
  viewer: Cesium.Viewer | null;
  setViewer: (viewer: Cesium.Viewer) => void;
}

const ViewerContext = createContext<ViewerContextType | undefined>(undefined);

export const ViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewer, setViewer] = React.useState<Cesium.Viewer | null>(null);

  return (
    <ViewerContext.Provider value={{ viewer, setViewer }}>
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