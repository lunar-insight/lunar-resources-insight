import React, { useRef } from 'react';
import SectionNavigation, { dialogs } from '../../components/navigation/SectionNavigation/SectionNavigation';
import './MainPage.scss';
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';
import { BoundaryRefProvider } from '../../components/reference/BoundaryRefProvider';
import { DialogProvider, DialogRenderer } from '../../utils/DialogWindowManagement';
import { LayerProvider } from '../../utils/context/LayerContext';

const MainPage = () => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <BoundaryRefProvider value={viewerContainerRef}>
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
    </BoundaryRefProvider>
  );
};

export default MainPage;