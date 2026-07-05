import React, { useRef } from 'react';
import * as Cesium from 'cesium';
import { useTrackedScreenPosition } from './useTrackedScreenPosition';
import styles from './NomenclatureSearch.module.scss';

interface SearchResultMarkerProps {
  viewer: Cesium.Viewer;
  lon: number;
  lat: number;
}

const SearchResultMarker: React.FC<SearchResultMarkerProps> = ({ viewer, lon, lat }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  useTrackedScreenPosition(viewer, lon, lat, elementRef, 'translate(-50%, -100%)');

  return (
    <div ref={elementRef} className={styles.searchResultMarker} style={{ display: 'none' }}>
      <span className={styles.searchResultMarkerPulse} />
      <svg
        className={styles.searchResultMarkerPin}
        viewBox="0 0 32 42"
        aria-hidden="true"
      >
        <path
          d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z"
          fill="#FFB020"
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        <circle cx="16" cy="16" r="6" fill="#FFFFFF" />
      </svg>
    </div>
  );
};

export default SearchResultMarker;
