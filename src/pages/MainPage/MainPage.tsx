import React, { useRef, useEffect } from 'react';
import SectionNavigation, { dialogs } from '../../components/navigation/SectionNavigation/SectionNavigation';
import './MainPage.scss';
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';
import { BoundaryRefProvider } from '../../components/reference/BoundaryRefProvider';
import { DialogProvider, DialogRenderer } from '../../utils/DialogWindowManagement';
import { LayerProvider } from '../../utils/context/LayerContext';
import { ViewerProvider } from 'utils/context/ViewerContext';
import { initializeLayerStats } from '../../services/LayerStatsService';
import { initializeColormapService } from '../../services/ColormapService';

const MainPage = () => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          initializeLayerStats(),
          initializeColormapService()
        ]);
        console.log('Services initialized');
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    init();
  }, []);
  
  return (
    <BoundaryRefProvider value={viewerContainerRef}>
      <ViewerProvider>
        <LayerProvider>
          <DialogProvider dialogs={dialogs}>
            <div className="main-page">
              <SectionNavigation />
              <div className="viewer-container" ref={viewerContainerRef}>
                <CesiumComponent className="cesium-component" />
              </div>
              <DialogRenderer />
            </div>
          </DialogProvider>
        </LayerProvider>
      </ViewerProvider>
    </BoundaryRefProvider>
  );
};

export default MainPage;