import React, { useRef } from 'react';
import SectionNavigation from '../../components/navigation/SectionNavigation/SectionNavigation';
import './MainPage.scss'
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';
import { BoundaryRefProvider } from '../../components/reference/BoundaryRefProvider';

const MainPage = () => {

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <BoundaryRefProvider value={viewerContainerRef}>
      <div className="main-page">
        <SectionNavigation />
        <div className="viewer-container" ref={viewerContainerRef}>
          <CesiumComponent className="cesium-component" />
        </div>
        
        {/* Content */}
      </div>
    </BoundaryRefProvider>
  );
};

export default MainPage;