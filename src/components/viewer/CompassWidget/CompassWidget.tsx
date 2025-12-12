import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../../layout/Tooltip/ButtonTooltip';
import { useViewer } from '../../../utils/context/ViewerContext';
import styles from './CompassWidget.module.scss';

/**
 * CompassWidget component displays a compass showing current camera orientation
 * and allows users to reset to north-facing orientation with a click.
 *
 * Features:
 * - Rotates in real-time based on camera heading (direct DOM manipulation for smoothness)
 * - Click to reset orientation (heading and roll to 0)
 * - Preserves camera position and pitch during reset
 * - Smooth animation using Cesium's flyTo
 */
const CompassWidget: React.FC = () => {
  const { viewer } = useViewer();
  const arrowGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!viewer || !arrowGroupRef.current) return;

    let animationFrameId: number;

    // Update compass rotation in real-time using direct DOM manipulation
    const updateRotation = () => {
      if (!viewer || !arrowGroupRef.current) return;

      const heading = viewer.camera.heading;
      const rotationDegrees = -Cesium.Math.toDegrees(heading);

      // Direct DOM manipulation
      arrowGroupRef.current.setAttribute('transform', `rotate(${rotationDegrees} 40 40)`);

      viewer.scene.requestRender();

      // Continue updating on every frame
      animationFrameId = requestAnimationFrame(updateRotation);
    };

    // Start continuous updates
    updateRotation();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [viewer]);

  /**
   * Resets camera orientation to north (heading = 0) while preserving
   * current position and pitch.
   */
  const handleResetOrientation = () => {
    if (!viewer) return;

    viewer.camera.flyTo({
      destination: viewer.camera.position,  // Preserve current position
      orientation: {
        heading: 0.0,                       // North pointing up
        pitch: viewer.camera.pitch,         // Preserve current tilt
        roll: 0.0                           // Reset roll
      },
      duration: 1.5,                        // Animation
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
  };

  return (
    <TooltipTrigger>
      <Button
        aria-label="Reset north orientation"
        className={styles.compassContainer}
        onPress={handleResetOrientation}
      >
        <svg viewBox="0 0 80 80" className={styles.compassSvg}>
          {/* Outer ring touching button edge */}
          <circle cx="40" cy="40" r="39.5" className={styles.compassRing} />

          {/* North/South compass needle, rotate based on camera heading */}
          <g ref={arrowGroupRef} transform="rotate(0 40 40)">
            <path d="M40,8 L33,40 L40,38 L47,40 Z" className={styles.northArrow} />
            <path d="M40,72 L33,40 L40,42 L47,40 Z" className={styles.southArrow} />
          </g>
        </svg>
      </Button>
      <ButtonTooltip placement="left">
        Reset north orientation
      </ButtonTooltip>
    </TooltipTrigger>
  );
};

export default CompassWidget;
