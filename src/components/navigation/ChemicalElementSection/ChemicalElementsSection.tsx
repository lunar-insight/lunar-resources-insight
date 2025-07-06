import React, { useState, useCallback, useRef, useEffect } from 'react'
import './ChemicalElementsSection.scss';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from './../../layout/ModalOverlayContainer/ModalOverlayContainer';
import PeriodicTable, { Element } from '../submenu/PeriodicTable/PeriodicTable'
import { GridListLayer, GridListLayerItem } from '../../layout/GridListLayerComponent/GridListLayerComponent';
import { useLayerContext } from '../../../utils/context/LayerContext';
import { layersConfig } from '../../../geoConfigExporter';
import LayerGradientSelect from '../../ui/LayerGradientSelect/LayerGradientSelect'
import { ColorRampSlider } from '../../layout/Slider/ColorRampSlider/ColorRampSlider';
import OpacitySlider from '../../layout/Slider/OpacitySlider/OpacitySlider';
import { RangeFilterCheckbox } from '../../layout/Checkbox/RangeFilterCheckbox/RangeFilterCheckbox';
import { layerStatsService } from '../../../services/LayerStatsService';
import { FeatureCheckbox } from '../../layout/Checkbox/FeatureCheckbox/FeatureCheckbox';
import { pointValueService } from '../../../services/PointValueService';
import { useViewer } from '../../../utils/context/ViewerContext';
import { DraggableBoxContentContainer } from '../../layout/DraggableBoxContentContainer/DraggableBoxContentContainer';
import { Portal } from '../../ui/Portal/Portal';
import '../../layout/BoxContentContainer/MapHoverValuesBox.scss';
import { ResourceBarsVisualizer } from '../../viewer/ResourceBarsVisualizer/ResourceBarsVisualizer';
import { useBoundaryRef } from '../../../components/reference/BoundaryRefProvider';

const ChemicalElementsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<(Element & { id: number })[]>([]);
  const [showValueBox, setShowValueBox] = useState(false);
  const [hoverValues, setHoverValues] = useState<{[key: string]: number} | null>(null);
  const [allHoverValues, setAllHoverValues] = useState<{[key: string]: number} | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const boundaryRef = useBoundaryRef();

  const { addLayer, removeLayer, reorderLayers, updateRampValues, updateLayerOpacity } = useLayerContext();

  const { viewer } = useViewer();

  // Initialize the service with the viewer and selected layers
  useEffect(() => {
    pointValueService.setViewer(viewer);
  }, [viewer]);

  useEffect(() => {
    // Update the service with current selected layers (only chemical ones)
    const chemicalLayers = selectedElements.flatMap(element => {
      const elementName = element.name.toLowerCase();
      return layerStatsService.getLayersByElement(elementName).map(([layerId, _]) => layerId);
    });

    pointValueService.setSelectedLayers(chemicalLayers);
  }, [selectedElements]);

  useEffect(() => {
    if (showValueBox) {
      const unsubscribe = pointValueService.onValuesUpdate((data) => {
        setHoverValues(data.displayValues); // Bar show
        setAllHoverValues(data.allValues); // Terrain calculation
        setIsPaused(data.isPaused || false);
      });

      return unsubscribe;
    } else {
      setHoverValues(null);
      setAllHoverValues(null);
      setIsPaused(false);
    }
  }, [showValueBox]);

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

  const handlePointFetchToggle = (isEnabled: boolean) => {
    setShowValueBox(isEnabled);
    if (isEnabled) {
      pointValueService.start();
    } else {
      pointValueService.stop();
      setHoverValues(null);
      setIsPaused(false);
    }
  };

  const handleOpenPeriodicTable = () => {
    setIsModalOpen(true);
  };

  const handleClosePeriodicTable = () => {
    setIsModalOpen(false);
  };


  const handleElementSelection = (element: Element) => {
    const elementWithId = { ...element, id: element.atomicNumber };
    const elementName = element.name.toLowerCase();
    const availableLayers = Object.entries(layersConfig.layers)
      .filter(([_, config]) =>
        config.category === 'chemical' &&
        config.element === elementName
      );

    if (availableLayers.length === 0) {
      console.warn(`No layers found for element ${element.name}`);
      return;
    }

    const elementSelected = selectedElements.some(
      el => el.id === element.atomicNumber
    );

    if (!elementSelected) {
      // Add every layer available for that element
      availableLayers.forEach(([layerId, _]) => {
        addLayer(layerId);
      });

      setSelectedElements(prev => [elementWithId, ...prev]);
    } else {
      // Delete layers from that element
      availableLayers.forEach(([layerId, _]) => {
        removeLayer(layerId);
      });

      setSelectedElements(prev =>
        prev.filter(el => el.id !== element.atomicNumber)
      );
    }
  };

  const handleReorder = (newItems: (Element & { id: number })[]) => {
    setSelectedElements(newItems);

    // Get all layer for the selected elements
    const newLayerIds: string[] = [];

    newItems.forEach(item => {
      const elementName= item.name.toLowerCase();
      const elementLayers = layerStatsService.getLayersByElement(elementName);
      const layerIds = elementLayers.map(([layerId, _]) => layerId);
      newLayerIds.push(...layerIds)
    })

    // Update the layers order in the context
    reorderLayers(newLayerIds);
  }

  const handleRemoveElement = (id: number) => {
    setSelectedElements(prev => {
      const element = prev.find(e => e.id === id);
      if (element) {
        const elementName = element.name.toLowerCase();
        const elementLayers = layerStatsService.getLayersByElement(elementName);

        elementLayers.forEach(([layerId, _]) => {
          removeLayer(layerId);
        });
      }
      return prev.filter(e => e.id !== id);
    });
  };

  const handleRampValueChange = (layerId: string, values: number[]) => {
    debouncedUpdateRampValues(layerId, values);
  };

  const handleOpacityChange = (layerId: string, value: number) => {
    const opacityValue = value / 100 // Cesium is 0-1
    updateLayerOpacity(layerId, opacityValue);
  }

  const renderValueBoxContent = () => {
    if (isPaused) {
      return (
        <div className="map-hover-values-box__paused">
          <p>⏸️ Scan paused</p>
          <small>Move the mouse on the globe to resume</small>
        </div>
      );
    }
    
    if (hoverValues && Object.keys(hoverValues).length > 0) {
      return (
        <ResourceBarsVisualizer 
          values={hoverValues} 
          allValues={allHoverValues}
          width={270} 
          height={250} 
        />
      );
    }
    
    return <p>Hover over the map to scan resources</p>;
  };

  return (
    <>
      <Button 
        className="chemical-section__open-periodic-table-button"
        onPress={handleOpenPeriodicTable}  
      >
        Open Periodic Table
      </Button>

      {selectedElements.length > 0 && (
        <div className='chemical-section__display-options'>
          <FeatureCheckbox 
            checked={showValueBox}
            onChange={handlePointFetchToggle}
          />
        </div>
      )}

      {showValueBox && (
        <Portal>
          <DraggableBoxContentContainer 
            className='map-hover-values-box'
            width={400}
            height={350}
            title="Element concentration"
            isOpen={showValueBox}
            onClose={() => handlePointFetchToggle(false)}
            boundaryRef={boundaryRef}
          >
            <div className='map-hover-values-box__content'>
              {renderValueBoxContent()}
            </div>
          </DraggableBoxContentContainer>
        </Portal>
      )}

      <ModalOverlayContainer
        isOpen={isModalOpen}
        onOpenChange={handleClosePeriodicTable}
        title="Periodic Table of Elements"
      >
        <PeriodicTable 
          onElementSelect={handleElementSelection} 
          selectedElements={selectedElements}  
        />
      </ModalOverlayContainer>
      <GridListLayer
        items={selectedElements}
        aria-label='Layer Selection'
        selectionMode="multiple"
        onReorder={handleReorder}
        centerText='No geographic layer selected, choose one or multiple above.'
      >
        {(item: Element & { id: number }) => {
          const elementName = item.name.toLowerCase();
          const [layerId, layerConfig] = Object.entries(layersConfig.layers)
            .find(([_, config]) => 
              config.category === 'chemical' &&
              config.element === elementName
            ) || [null, null];
          
          if (!layerId || !layerConfig) {
            return null;
          }

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
            textValue={`${item.name} (${item.symbol})`}
            onRemove={() => handleRemoveElement(item.id)}
            layerId={layerId}
            accordionContent={
              <div className='chemical-section__accordion-content'>
                Description: {item.atomicNumber}
                <LayerGradientSelect layerId={layerId}/>
                <div className='chemical-section__accordion-content__ramp-container'>

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
            {item.name} ({item.symbol})
          </GridListLayerItem>
          );
        }}
      </GridListLayer>
    </>
  );
};

export default ChemicalElementsSection;