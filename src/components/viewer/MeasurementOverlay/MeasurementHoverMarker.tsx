import React, { useId } from 'react';
import styles from './MeasurementHoverMarker.module.scss';

interface MeasurementHoverMarkerProps {
  wrapperRef: React.RefObject<HTMLDivElement>;
  lineRef: React.RefObject<SVGLineElement>;
}

// Non-interactive beacon showing where the next measurement point would
// land. Position updates imperatively, via direct style/attribute writes
// from MeasurementLineService's onHoverPosition callback, since it fires on
// every mousemove; the refs are supplied by the parent so it can write into
// this DOM directly.
const MeasurementHoverMarker: React.FC<MeasurementHoverMarkerProps> = ({ wrapperRef, lineRef }) => {
  const gradientId = useId();

  return (
    <div ref={wrapperRef} className={styles.measurementHoverMarker} style={{ display: 'none' }}>
      <svg className={styles.beaconSvg}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <line
          ref={lineRef}
          x1="0"
          y1="0"
          x2="0"
          y2="0"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <circle className={styles.capRing} cx="0" cy="0" r="3" />
      </svg>
    </div>
  );
};

export default MeasurementHoverMarker;
