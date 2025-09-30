import React, { useCallback, useRef } from 'react';
import { useSidebarContext } from '../../../utils/context/SidebarContext';
import { useLayerContext } from '../../../utils/context/LayerContext';
import { layersConfig } from '../../../geoConfigExporter';
import { GridListLayer, GridListLayerItem } from '../GridListLayerComponent/GridListLayerComponent';
import { layerStatsService } from '../../../services/LayerStatsService';
import LayerGradientSelect from '../../ui/LayerGradientSelect/LayerGradientSelect';
import { ColorRampSlider } from '../Slider/ColorRampSlider/ColorRampSlider';
import OpacitySlider from '../Slider/OpacitySlider/OpacitySlider';
import { RangeFilterCheckbox } from '../Checkbox/RangeFilterCheckbox/RangeFilterCheckbox';
import CloseButton from '../Button/CloseButton/CloseButton';
import styles from './Sidebar.module.scss';

interface SidebarProps {
  width?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ width = 400 }) => {
  const { isSidebarOpen, closeSidebar } = useSidebarContext();
  const {
    selectedLayers,
    removeLayer,
    reorderLayers,
    updateRampValues,
    updateLayerOpacity
  } = useLayerContext();

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Layer ID to items
  const layerItems = selectedLayers.map((layerId) => {
    const config = layersConfig.layers[layerId];
    return {
      id: layerId,
      displayName: config?.displayName || layerId,
      category: config?.category,
      element: config?.element
    };
  });

  const handleReorder = (newItems: typeof layerItems) => {
    const newLayerIds = newItems.map(item => item.id);
    reorderLayers(newLayerIds);
  };

  const debouncedUpdateRampValues = useCallback((layerId: string, values: number[]) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (values.length === 2) {
        updateRampValues(layerId, values[0], values[1]);
      }
      debounceTimeoutRef.current = null;
    }, 300);
  }, [updateRampValues]);
  

  const handleRampValueChange = (layerId: string, values: number[]) => {
    debouncedUpdateRampValues(layerId, values);
  };

  const handleOpacityChange = (layerId: string, value: number) => {
    const opacityValue = value / 100;
    updateLayerOpacity(layerId, opacityValue);
  };

  return (
    <div
      className={`${styles.sidebar} ${isSidebarOpen ? styles.open : styles.closed}`}
      style={{ width: `${width}px` }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Layer Management</h3>
        <CloseButton
          onPress={closeSidebar}
          className={styles.closeButton}
        />
      </div>

      <div className={styles.content}>
        <GridListLayer
          items={layerItems}
          aria-label='Layer Selection'
          selectionMode="multiple"
          onReorder={handleReorder}
          centerText='No geographic layer selected.'
        >
          {(item: typeof layerItems[0]) => {
            const layerId = item.id;
            const stats = layerStatsService.getLayerStats(layerId);

            let sliderMinValue, sliderMaxValue, sliderStep;

            if (stats.loaded) {
              const range = stats.max - stats.min;
              sliderMinValue = stats.min;
              sliderMaxValue = stats.max;
              sliderStep = Math.max(range / 1000, 0.001); // Minimum of 0.001
            } else {
              // Default value if stats are not loaded
              sliderMinValue = 0;
              sliderMaxValue = 100;
              sliderStep = 0.001;
            }

            return (
              <GridListLayerItem 
                key={item.id}
                textValue={item.displayName}
                onRemove={() => removeLayer(layerId)}
                layerId={layerId}
                accordionContent={
                  <div className={styles.accordionContent}>
                    <LayerGradientSelect layerId={layerId}/>

                    <div className={styles.rampContainer}>
                      {stats.loaded ? (
                        <ColorRampSlider
                          label="Color Ramp Values"
                          defaultValue={[stats.min, stats.max]}
                          minValue={sliderMinValue}
                          maxValue={sliderMaxValue}
                          absoluteMin={stats.min}
                          absoluteMax={stats.max}
                          step={sliderStep}
                          thumbLabels={['Min', 'Max']}
                          onChange={(values) => handleRampValueChange(layerId, values as number[])}
                        />
                      ) : (
                        <div>Layer statistics not loaded, remove and re-add the element map...</div>
                      )}
                      <RangeFilterCheckbox layerId={layerId} />
                    </div>

                    <OpacitySlider
                      label="Layer Opacity"
                      defaultValue={100}
                      minValue={0}
                      maxValue={100}
                      step={1}
                      onChange={(value) => handleOpacityChange(layerId, value as number)}
                    />
                  </div>
                }  
              >
                {item.displayName}
            </GridListLayerItem>
            );
          }}
        </GridListLayer>
      </div>
    </div>
  );
};

export default Sidebar;