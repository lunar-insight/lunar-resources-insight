import React from 'react';
import SidebarNavigation from '../navigation/SidebarNavigation/SidebarNavigation';
import './MainPage.scss'
import CesiumComponent from '../viewer/CesiumComponent/CesiumComponent';

const MainPage = () => {

  //const { component: Cesium } = CesiumComponent; //  Destructuration of the component property from the CesiumComponent object
  return (
    <div className="main-page">
      <SidebarNavigation />
      <CesiumComponent className="cesium-component" />
      {/* Content */}
    </div>
  );
};

export default MainPage;