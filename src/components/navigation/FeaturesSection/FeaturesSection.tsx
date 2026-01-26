import React, { useRef, useEffect, useMemo } from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { TwoPointCircleIcon } from './icons/TwoPointCircleIcon';
import { ThreePointCircleIcon } from './icons/ThreePointCircleIcon';
import { DrawingToolToggleButton } from './components/DrawingToolToggleButton';
import { FeaturesList } from './components/FeaturesList';
import { VisibilityToggleButton } from './components/VisibilityToggleButton';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useViewer } from 'utils/context/ViewerContext';
import { useBoundaryRef } from 'components/reference/BoundaryRefProvider';
import { FeatureDrawingService } from 'services/FeatureDrawingService';
import DraggableBoxContentContainer from 'components/layout/DraggableBoxContentContainer/DraggableBoxContentContainer';
import { Portal } from 'components/ui/Portal/Portal';
import styles from './FeaturesSection.module.scss';
import insightsStyles from './FeatureInsightsBox.module.scss';

const FeaturesSection: React.FC = () => {
  const {
    features,
    activeDrawingTool,
    setActiveDrawingTool,
    addFeature,
    updateFeaturePosition,
    updateLinePositions,
    updatePolygonPositions,
    updateCircleCenter,
    toggleFeatureInsights,
    showFeatures,
    showLabels,
    toggleFeatureVisibility,
    toggleLabelVisibility,
  } = useFeaturesContext();
  const { viewer } = useViewer();
  const boundaryRef = useBoundaryRef();
  const featureDrawingServiceRef = useRef<FeatureDrawingService | null>(null);

  // Initialize drawing service (once, destroy only on unmount)
  useEffect(() => {
    if (!featureDrawingServiceRef.current) {
      featureDrawingServiceRef.current = new FeatureDrawingService();
    }

    return () => {
      // Only destroy on actual unmount
      if (featureDrawingServiceRef.current) {
        featureDrawingServiceRef.current.destroy();
        featureDrawingServiceRef.current = null;
      }
    };
  }, []);

  // Update viewer and callbacks (without destroying the service)
  useEffect(() => {
    const service = featureDrawingServiceRef.current;
    if (!service) return;

    if (viewer) {
      service.setViewer(viewer);
      service.setCallbacks(
        (feature) => {
          // Point created callback
          addFeature(feature);
          setActiveDrawingTool(null);
        },
        () => {
          // Drawing cancelled callback
          setActiveDrawingTool(null);
        },
        (id, position) => {
          updateFeaturePosition(id, position);
        },
        (id, positions) => {
          // Line positions updated callback
          updateLinePositions(id, positions);
        },
        (id, positions) => {
          // Polygon positions updated callback
          updatePolygonPositions(id, positions);
        },
        (id, center) => {
          // Circle center updated callback
          updateCircleCenter(id, center);
        }
      );
    }
  }, [viewer, addFeature, setActiveDrawingTool, updateFeaturePosition, updateLinePositions, updatePolygonPositions, updateCircleCenter]);

  // Update drawing service visibility state
  useEffect(() => {
    if (featureDrawingServiceRef.current) {
      featureDrawingServiceRef.current.setVisibility(showFeatures, showLabels);
    }
  }, [showFeatures, showLabels]);

  // Track line features for cleanup and visibility updates
  const lineFeatures = useMemo(
    () => features.filter(f => f.type === 'line'),
    [features]
  );
  const lineFeatureIds = useMemo(
    () => lineFeatures.map(f => f.id),
    [lineFeatures]
  );
  const prevLineFeatureIdsRef = useRef<string[]>([]);

  // Manage vertex markers when line features change or viewer becomes available
  useEffect(() => {
    const service = featureDrawingServiceRef.current;
    if (!service) return;

    const prevIds = prevLineFeatureIdsRef.current;
    const currentIds = lineFeatureIds;

    // Find removed line feature IDs - clean up their markers
    const removedIds = prevIds.filter(id => !currentIds.includes(id));
    removedIds.forEach(id => service.removeLineVertexMarkers(id));

    // Ensure all current lines have vertex markers when viewer is available
    // This handles both newly added lines and existing lines when viewer becomes ready
    // The method internally skips lines that already have markers
    if (viewer) {
      currentIds.forEach(id => service.ensureVertexMarkersForLine(id));
    }

    // Update ref for next comparison
    prevLineFeatureIdsRef.current = currentIds;
  }, [lineFeatureIds, viewer]);

  // Update vertex marker visibility when line feature visibility changes
  useEffect(() => {
    const service = featureDrawingServiceRef.current;
    if (!service) return;

    // Update vertex marker visibility for each line feature
    lineFeatures.forEach(lineFeature => {
      // Vertex markers should be visible only if:
      // 1. Global showFeatures is true, AND
      // 2. The specific line feature is visible
      const shouldShow = showFeatures && lineFeature.visible;
      service.updateLineVertexMarkersVisibility(lineFeature.id, shouldShow);
    });
  }, [lineFeatures, showFeatures]);

  const handleToggleDrawingTool = (tool: string, selected: boolean) => {
    if (selected) {
      setActiveDrawingTool(tool);
      featureDrawingServiceRef.current?.startDrawing(tool);
    } else {
      setActiveDrawingTool(null);
      featureDrawingServiceRef.current?.cancelDrawing();
    }
  };

  return (
    <>
      {/* Drawing Tools Section */}
      <div className={styles.section}>
        <h3 className={styles.title}>Drawing Tools</h3>

        <div className={styles.toolsWrapper}>
          <div className={styles.toolsContainer}>
            <DrawingToolToggleButton
              value="point"
              icon="point_scan"
              tooltip="Draw points"
              isSelected={activeDrawingTool === 'point'}
              onChange={(selected) => handleToggleDrawingTool('point', selected)}
            />

            <DrawingToolToggleButton
              value="line"
              icon="diagonal_line"
              tooltip="Draw lines"
              isSelected={activeDrawingTool === 'line'}
              onChange={(selected) => handleToggleDrawingTool('line', selected)}
            />

            <DrawingToolToggleButton
              value="polygon"
              icon="hexagon"
              tooltip="Draw polygons"
              isSelected={activeDrawingTool === 'polygon'}
              onChange={(selected) => handleToggleDrawingTool('polygon', selected)}
            />

            <DrawingToolToggleButton
              value="circle"
              icon="circle"
              tooltip="Draw circles"
              isSelected={activeDrawingTool === 'circle'}
              onChange={(selected) => handleToggleDrawingTool('circle', selected)}
            />

            <DrawingToolToggleButton
              value="two-point-circle"
              customIcon={<TwoPointCircleIcon />}
              tooltip="Draw circle by two points"
              isSelected={activeDrawingTool === 'two-point-circle'}
              onChange={(selected) => handleToggleDrawingTool('two-point-circle', selected)}
            />

            <DrawingToolToggleButton
              value="three-point-circle"
              customIcon={<ThreePointCircleIcon />}
              tooltip="Draw circle by three points"
              isSelected={activeDrawingTool === 'three-point-circle'}
              onChange={(selected) => handleToggleDrawingTool('three-point-circle', selected)}
            />
          </div>

          <div className={styles.separator}></div>

          <TooltipTrigger>
            <Button
              onPress={() => {}}
              aria-label="Upload Shape Tool"
              className={styles.uploadButton}
            >
              <span className={`material-symbols-outlined ${styles.icon}`}>upload</span>
            </Button>
            <ButtonTooltip placement="right">
              Upload Shape
            </ButtonTooltip>
          </TooltipTrigger>
        </div>
      </div>

      {/* Features List Section */}
      <div className={styles.section}>
        <h3 className={styles.title}>Selected Features</h3>
        <div className={styles.visibilityControls}>
          <VisibilityToggleButton
            isSelected={showFeatures}
            onChange={toggleFeatureVisibility}
            label="Features"
            tooltip="Show/hide features on globe"
          />
          <VisibilityToggleButton
            isSelected={showLabels}
            onChange={toggleLabelVisibility}
            label="Labels"
            tooltip="Show/hide feature labels"
            isDisabled={!showFeatures}
          />
        </div>
        <FeaturesList />
      </div>

      {/* Insights Boxes */}
      {features.map((feature) => {
        // Calculate cascade index based only on currently open insights
        const openFeatures = features.filter(f => f.insightsOpen);
        const cascadeIndex = openFeatures.findIndex(f => f.id === feature.id);

        return (
          <Portal key={feature.id}>
            <DraggableBoxContentContainer
              className={insightsStyles.featureInsightsBox}
              isOpen={feature.insightsOpen}
              onClose={() => toggleFeatureInsights(feature.id)}
              title={`Insights: ${feature.name}`}
              boundaryRef={boundaryRef}
              cascadeIndex={cascadeIndex >= 0 ? cascadeIndex : 0}
              width={400}
              height={300}
              id={`feature-insights-${feature.id}`}
            >
              <div className={insightsStyles.content}>
                <p>Insights content</p>
                <small>Feature: {feature.name}</small>
              </div>
            </DraggableBoxContentContainer>
          </Portal>
        );
      })}
    </>
  );
};

export default FeaturesSection;
