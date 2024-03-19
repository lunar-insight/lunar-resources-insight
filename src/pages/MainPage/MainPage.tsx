import React, { useRef } from 'react';
import SectionNavigation from '../../components/navigation/SectionNavigation/SectionNavigation';
import './MainPage.scss'
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';

const MainPage = () => {

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="main-page">
      <SectionNavigation boundaryRef={viewerContainerRef}/>
      <div className="viewer-container" ref={viewerContainerRef}>
        <CesiumComponent className="cesium-component" />
      </div>
      
      {/* Content */}
    </div>
  );
};

export default MainPage;