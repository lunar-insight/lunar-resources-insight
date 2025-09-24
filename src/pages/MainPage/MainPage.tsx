import React, { useRef, useEffect } from 'react';
import SectionNavigation, { dialogs } from '../../components/navigation/SectionNavigation/SectionNavigation';
import styles from './MainPage.module.scss';
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';
import { BoundaryRefProvider } from '../../components/reference/BoundaryRefProvider';
import { DialogProvider, DialogRenderer } from '../../utils/DialogWindowManagement';
import { SidebarProvider, useSidebarContext } from '../../utils/context/SidebarContext';
import Sidebar from '../../components/layout/Sidebar/Sidebar';
import { LayerProvider } from '../../utils/context/LayerContext';
import { ViewerProvider } from 'utils/context/ViewerContext';
import { initializeLayerStats } from '../../services/LayerStatsService';
import { initializeColormapService } from '../../services/ColormapService';
import { ZIndexProvider } from 'utils/ZIndexProvider';
import { MouseTrackingProvider } from 'utils/MouseTrackingProvider';

const MainPageContent: React.FC = () => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const { isSidebarOpen } = useSidebarContext();

  const sidebarWidth = 400;

  return (
    <BoundaryRefProvider value={viewerContainerRef}>
      <DialogProvider dialogs={dialogs}>
        <div className={styles.mainPage}>
          <Sidebar width={sidebarWidth} />
          <div className={styles.mainContent}>
            <SectionNavigation />
            <div 
              className={styles.viewerContainer} 
              ref={viewerContainerRef}
              style={{
                marginLeft: isSidebarOpen ? `${sidebarWidth}px` : '0',
                transition: 'margin-left 0.3s ease-in-out'
              }}
            >
              <CesiumComponent className={styles.cesiumComponent} />
            </div>
          </div>
          <DialogRenderer />
        </div>
      </DialogProvider>
    </BoundaryRefProvider>
  );
}



const MainPage = () => {
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
    <ViewerProvider>
      <MouseTrackingProvider>
        <LayerProvider>
          <ZIndexProvider>
            <SidebarProvider>
              <MainPageContent />
            </SidebarProvider>
          </ZIndexProvider>  
        </LayerProvider>
      </MouseTrackingProvider>
    </ViewerProvider>
  );
};

export default MainPage;