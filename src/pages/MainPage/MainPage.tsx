import React from 'react';
import SidebarNavigation from '../../components/navigation/SidebarNavigation/SidebarNavigation';
import './MainPage.scss'
import CesiumComponent from '../../components/viewer/CesiumComponent/CesiumComponent';

const MainPage = () => {

  return (
    <div className="main-page">
      <SidebarNavigation />
      <CesiumComponent className="cesium-component" />
      {/* Content */}
    </div>
  );
};

export default MainPage;