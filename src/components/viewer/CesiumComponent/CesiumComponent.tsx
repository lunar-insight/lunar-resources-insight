import React from 'react';
import { Viewer } from 'cesium';

const CesiumComponent = () => {
  React.useEffect(() => {
    const viewer = new Viewer('cesiumContainer');
    // Cesium code
  }, []);

  return (
    <div id="cesiumContainer" style={{ width: '100%', height: '100%', position: 'absolute'}} />
  );
};

export default {
  title: 'CesiumComponent',
  component: CesiumComponent,
};

export const Default = () => <CesiumComponent />;