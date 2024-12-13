import React, { useRef } from 'react';
import SectionNavigation, { dialogs } from '../../components/navigation/SectionNavigation/SectionNavigation';
import './MainPage.scss';
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';
import { BoundaryRefProvider } from '../../components/reference/BoundaryRefProvider';
import { DialogProvider, DialogRenderer } from '../../utils/DialogWindowManagement';
import { LayerProvider } from '../../utils/context/LayerContext';
import { StyleProvider } from 'utils/context/StyleContext';

const MainPage = () => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <BoundaryRefProvider value={viewerContainerRef}>
      <StyleProvider>
        <DialogProvider dialogs={dialogs}>
          <LayerProvider>
            <div className="main-page">
              <SectionNavigation />
              <div className="viewer-container" ref={viewerContainerRef}>
                <CesiumComponent className="cesium-component" />
              </div>
              <DialogRenderer />
            </div>
          </LayerProvider>
        </DialogProvider>
      </StyleProvider>
    </BoundaryRefProvider>
  );
};

export default MainPage;