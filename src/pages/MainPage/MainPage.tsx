import React, { useRef } from 'react';
import SectionNavigation, { dialogs } from '../../components/navigation/SectionNavigation/SectionNavigation';
import './MainPage.scss';
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';
import { BoundaryRefProvider } from '../../components/reference/BoundaryRefProvider';
import { DialogProvider, DialogRenderer } from '../../utils/DialogWindowManagement';
import { LayerProvider } from '../../utils/context/LayerContext';
import { StyleProvider } from 'utils/context/StyleContext';
import { ViewerProvider } from 'utils/context/ViewerContext';

const MainPage = () => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <BoundaryRefProvider value={viewerContainerRef}>
      <ViewerProvider>
        <StyleProvider>
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
        </StyleProvider>
      </ViewerProvider>
    </BoundaryRefProvider>
  );
};

export default MainPage;