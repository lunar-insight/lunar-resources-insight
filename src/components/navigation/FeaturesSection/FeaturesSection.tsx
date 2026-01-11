import React, { useRef, useEffect } from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { TwoPointCircleIcon } from './icons/TwoPointCircleIcon';
import { ThreePointCircleIcon } from './icons/ThreePointCircleIcon';
import { DrawingToolToggleButton } from './components/DrawingToolToggleButton';
import { FeaturesList } from './components/FeaturesList';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useViewer } from 'utils/context/ViewerContext';
import { useBoundaryRef } from 'components/reference/BoundaryRefProvider';
import { FeatureDrawingService } from 'services/FeatureDrawingService';
import DraggableBoxContentContainer from 'components/layout/DraggableBoxContentContainer/DraggableBoxContentContainer';
import { Portal } from 'components/ui/Portal/Portal';
import styles from './FeaturesSection.module.scss';
import './FeatureInsightsBox.scss';

const FeaturesSection: React.FC = () => {
  const {
    features,
    activeDrawingTool,
    setActiveDrawingTool,
    addFeature,
    toggleFeatureInsights,
  } = useFeaturesContext();
  const { viewer } = useViewer();
  const boundaryRef = useBoundaryRef();
  const featureDrawingServiceRef = useRef<FeatureDrawingService | null>(null);

  // Initialize drawing service
  useEffect(() => {
    if (!featureDrawingServiceRef.current) {
      featureDrawingServiceRef.current = new FeatureDrawingService();
    }

    const service = featureDrawingServiceRef.current;

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
        }
      );
    }

    return () => {
      service.destroy();
    };
  }, [viewer, addFeature, setActiveDrawingTool]);

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
        <FeaturesList />
      </div>

      {/* Insights Boxes */}
      {features.map((feature) => {
        if (!feature.insightsOpen) return null;

        // Calculate cascade index based only on currently open insights
        const openFeatures = features.filter(f => f.insightsOpen);
        const cascadeIndex = openFeatures.findIndex(f => f.id === feature.id);

        return (
          <Portal key={feature.id}>
            <DraggableBoxContentContainer
              className='feature-insights-box'
              isOpen={true}
              onClose={() => toggleFeatureInsights(feature.id)}
              title={`Insights: ${feature.name}`}
              boundaryRef={boundaryRef}
              cascadeIndex={cascadeIndex >= 0 ? cascadeIndex : 0}
              width={400}
              height={300}
              id={`feature-insights-${feature.id}`}
            >
              <div className='feature-insights-box__content'>
                <p>Insights content coming soon...</p>
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
