import React, { useRef, useEffect } from 'react';
import SectionNavigation, { dialogs } from 'components/navigation/SectionNavigation/SectionNavigation';
import styles from './MainPage.module.scss';
import CesiumComponent from 'components/viewer/CesiumComponent/CesiumComponent';
import CompassWidget from 'components/viewer/CompassWidget/CompassWidget';
import NomenclatureSearch from 'components/viewer/NomenclatureSearch/NomenclatureSearch';
import FeaturePointsOverlay from 'components/navigation/FeaturesSection/components/FeaturePointsOverlay';
import MeasurementOverlay from 'components/viewer/MeasurementOverlay/MeasurementOverlay';
import GlobeContextMenu from 'components/viewer/GlobeMenu/GlobeContextMenu';
import PointDropOverlay from 'components/viewer/PointDrop/PointDropOverlay';
import ToastRegion from 'components/viewer/Toast/ToastRegion';
import { BoundaryRefProvider } from 'components/reference/BoundaryRefProvider';
import { DialogProvider, DialogRenderer } from 'utils/DialogWindowManagement';
import { SidebarProvider, useSidebarContext } from 'utils/context/SidebarContext';
import Sidebar from 'components/layout/Sidebar/Sidebar';
import { LayerProvider } from 'utils/context/LayerContext';
import { ViewerProvider } from 'utils/context/ViewerContext';
import { FeaturesProvider } from 'utils/context/FeaturesContext';
import { MeasurementProvider } from 'utils/context/MeasurementContext';
import { initializeLayerStats } from 'services/LayerStatsService';
import { initializeColormapService } from 'services/ColormapService';
import { ZIndexProvider } from 'utils/ZIndexProvider';
import { MouseTrackingProvider } from 'utils/MouseTrackingProvider';
import BottomBar from 'components/layout/BottomBar/BottomBar';
import TopBar from 'components/layout/TopBar/TopBar';
import { ScannerProvider } from 'utils/context/ScannerContext';
import { InspectorProvider } from 'utils/context/InspectorContext';
import { AppSettingsProvider } from 'utils/context/AppSettingsContext';
import { GlobePopupProvider } from 'utils/context/GlobePopupContext';
import { PointDropProvider } from 'utils/context/PointDropContext';
import { ToastProvider } from 'utils/context/ToastContext';
import { InspectorWindows } from 'components/inspector/InspectorWindows';
import { ComparisonView } from 'components/inspector/ComparisonView/ComparisonView';

const MainPageContent: React.FC = () => {
  const mainContentRef = useRef<HTMLDivElement>(null);
  const { isSidebarOpen } = useSidebarContext();

  const sidebarWidth = 400;

  return (
    <BoundaryRefProvider value={mainContentRef}>
      <DialogProvider dialogs={dialogs}>
        <PointDropProvider>
          <div className={styles.mainPage}>
            <Sidebar width={sidebarWidth} />
            <div className={styles.mainContent} ref={mainContentRef}>
              <SectionNavigation />
              <div
                className={styles.viewerContainer}
                style={{
                  marginLeft: isSidebarOpen ? `${sidebarWidth}px` : '0',
                  transition: 'margin-left 0.3s ease-in-out'
                }}
              >
                <CesiumComponent className={styles.cesiumComponent} />
                <CompassWidget />
                <NomenclatureSearch />
                <FeaturePointsOverlay />
                <PointDropOverlay />
                <MeasurementOverlay />
                <GlobeContextMenu />
                <ToastRegion />
              </div>
            </div>
            <DialogRenderer />
            <InspectorWindows />
            <ComparisonView />
            <TopBar />
            <BottomBar />
          </div>
        </PointDropProvider>
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
    <AppSettingsProvider>
      <ToastProvider>
        <ViewerProvider>
          <MouseTrackingProvider>
            <LayerProvider>
              <FeaturesProvider>
                <InspectorProvider>
                  <MeasurementProvider>
                    <GlobePopupProvider>
                      <ZIndexProvider>
                        <SidebarProvider>
                          <ScannerProvider>
                            <MainPageContent />
                          </ScannerProvider>
                        </SidebarProvider>
                      </ZIndexProvider>
                    </GlobePopupProvider>
                  </MeasurementProvider>
                </InspectorProvider>
              </FeaturesProvider>
            </LayerProvider>
          </MouseTrackingProvider>
        </ViewerProvider>
      </ToastProvider>
    </AppSettingsProvider>
  );
};

export default MainPage;