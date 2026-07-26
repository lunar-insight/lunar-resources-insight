import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSidebarContext } from 'utils/context/SidebarContext';
import { useLayerContext } from 'utils/context/LayerContext';
import { layersConfig } from 'geoConfigExporter';
import { GridListLayer, GridListLayerItem } from '../GridListLayerComponent/GridListLayerComponent';
import { layerStatsService } from 'services/LayerStatsService';
import { stacService, getStacRole, LayerRole } from 'services/StacService';
import LayerGradientSelect from 'components/ui/LayerGradientSelect/LayerGradientSelect';
import { ColorRampSlider } from '../Slider/ColorRampSlider/ColorRampSlider';
import OpacitySlider from '../Slider/OpacitySlider/OpacitySlider';
import { RangeFilterCheckbox } from '../Checkbox/RangeFilterCheckbox/RangeFilterCheckbox';
import { GradientLockCheckbox } from '../Checkbox/GradientLockCheckbox/GradientLockCheckbox';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import CloseButton from '../Button/CloseButton/CloseButton';
import { VariantSelector } from 'components/ui/VariantSelector/VariantSelector';
import { useLayerBulkVisibility } from './useLayerBulkVisibility';
import { DERIVED_INDEX_BY_LAYER_ID } from 'components/navigation/submenu/DerivedIndices/data';
import styles from './Sidebar.module.scss';

interface SidebarProps {
  width?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ width = 400 }) => {
  const { isSidebarOpen, closeSidebar } = useSidebarContext();
  const {
    selectedLayers,
    visibleLayers,
    dynamicLayerMetadata,
    removeLayer,
    reorderLayers,
    updateRampValues,
    updateLayerOpacity,
    setBulkLayerVisibility,
    statsVersion: _statsVersion,
  } = useLayerContext();

  const { showAll, hideAll } = useLayerBulkVisibility(
    selectedLayers,
    visibleLayers,
    setBulkLayerVisibility,
  );

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [layerRoles, setLayerRoles] = useState<Map<string, LayerRole | undefined>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const layersWithStac = selectedLayers
      .map((layerId) => ({ layerId, stac: layersConfig.layers[layerId]?.stac }))
      .filter((entry): entry is { layerId: string; stac: string } => !!entry.stac);

    Promise.all(
      layersWithStac.map(({ layerId, stac }) =>
        stacService.fetchStacItem(stac).then((item) => [layerId, item] as const)
      )
    ).then((entries) => {
      if (cancelled) return;

      setLayerRoles((prev) => {
        const next = new Map(prev);
        entries.forEach(([layerId, item]) => {
          next.set(layerId, item ? getStacRole(item.properties) : undefined);
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedLayers]);

  // Layer ID to items
  const layerItems = selectedLayers.map((layerId, index) => {
    const config = layersConfig.layers[layerId];
    const dynamicMeta = dynamicLayerMetadata.get(layerId);

    // Detect category change
    const prevLayerId = index > 0 ? selectedLayers[index - 1] : null;
    let isFirstOfNewCategory = false;

    if (prevLayerId) {
      const prevConfig = layersConfig.layers[prevLayerId];
      const prevDynamicMeta = dynamicLayerMetadata.get(prevLayerId);
      const prevCategory = prevConfig?.category || prevDynamicMeta?.category;
      const currentCategory = config?.category || dynamicMeta?.category;
      isFirstOfNewCategory = prevCategory !== currentCategory;
    }

    return {
      id: layerId,
      displayName: config?.displayName || dynamicMeta?.displayName || layerId,
      category: config?.category || dynamicMeta?.category,
      element: config?.element || dynamicMeta?.element,
      compound: config?.compound,
      role: layerRoles.get(layerId),
      isFirstOfNewCategory
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

  const handleRemoveAll = useCallback(() => {
    selectedLayers.forEach(layerId => removeLayer(layerId));
  }, [selectedLayers, removeLayer]);

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

      <div className={styles.bulkControls}>
        <Button
          className={styles.bulkButton}
          isDisabled={selectedLayers.length === 0}
          onPress={showAll}
        >
          <span className={`material-symbols-outlined ${styles.icon} ${styles.iconVisible}`}>visibility</span>
          <span className={styles.label}>Show All</span>
        </Button>
        <Button
          className={styles.bulkButton}
          isDisabled={selectedLayers.length === 0}
          onPress={hideAll}
        >
          <span className={`material-symbols-outlined ${styles.icon} ${styles.iconHidden}`}>visibility_off</span>
          <span className={styles.label}>Hide All</span>
        </Button>
        <div className={styles.separator} />
        <TooltipTrigger>
          <Button
            className={styles.deleteButton}
            isDisabled={selectedLayers.length === 0}
            onPress={handleRemoveAll}
            aria-label="Remove all layers"
          >
            <span className={`material-symbols-outlined ${styles.icon} ${styles.iconDelete}`}>delete_sweep</span>
          </Button>
          <ButtonTooltip placement="right">Remove all layers</ButtonTooltip>
        </TooltipTrigger>
      </div>

      <div className={styles.content}>
        <GridListLayer
          items={layerItems}
          aria-label='Layer Selection'
          selectionMode="none"
          onReorder={handleReorder}
          centerText={
            <>
              No geographic layer selected.
              <br /><br />
              Select via Base Maps, Minerals or Chemistry.
            </>
          }
        >
          {(item) => {
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
                category={item.category}
                element={item.element}
                compound={item.compound}
                role={item.role}
                isFirstOfNewCategory={item.isFirstOfNewCategory}
                accordionContent={
                  <div className={styles.accordionContent}>
                    <VariantSelector layerId={layerId} />
                    <LayerGradientSelect layerId={layerId}/>

                    {(() => {
                      const labels = layersConfig.layers[layerId]?.isDerivedIndex
                        ? DERIVED_INDEX_BY_LAYER_ID[layerId]
                        : undefined;
                      if (!labels) return null;
                      return (
                        <div className={styles.interpretationBar}>
                          <span className={styles.interpretationLabel}>{labels.lowLabel}</span>
                          <span className={styles.interpretationArrow}>{'◄' + '─'.repeat(20) + '►'}</span>
                          <span className={styles.interpretationLabel}>{labels.highLabel}</span>
                        </div>
                      );
                    })()}

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
                      <GradientLockCheckbox layerId={layerId} />
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