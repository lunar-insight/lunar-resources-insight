import React, { useEffect, useRef } from 'react';
import { Viewer } from 'cesium';
import 'cesium/Source/Widgets/widgets.css'

const CesiumComponent = ({ className }: { className?: string }) => {
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    viewerRef.current = new Viewer('cesiumContainer');
    // Cesium code

/*     const handleResize = () => {
      if (viewerRef.current) {
        viewerRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('resize', handleResize);
    }; */
  }, []);

  return (
    <div id="cesiumContainer" className={className} />
  );
};

export default CesiumComponent;