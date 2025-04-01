import React, { useState } from 'react'
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

const ChemicalElementsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<(Element & { id: number })[]>([]);
  const { addLayer, removeLayer, reorderLayers, updateRampValues, updateLayerOpacity } = useLayerContext();

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

      setSelectedElements(prev => [...prev, elementWithId]);
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
    if (values.length === 2) {
      updateRampValues(layerId, values[0], values[1]);
    }
  };

  const handleOpacityChange = (layerId: string, value: number) => {
    const opacityValue = value / 100 // Cesium is 0-1
    updateLayerOpacity(layerId, opacityValue);
  }

  return (
    <>
      <Button 
        className="chemical-section__open-periodic-table-button"
        onPress={handleOpenPeriodicTable}  
      >
        Open Periodic Table
      </Button>
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
                  <ColorRampSlider
                    label="Color Ramp Values"
                    defaultValue={[stats.min, stats.max]}
                    minValue={layerConfig.metadata?.min || 0}
                    maxValue={layerConfig.metadata?.max || 100}
                    step={0.001}
                    thumbLabels={['Min', 'Max']}
                    onChange={(values) => handleRampValueChange(layerId, values as number[])}
                  />
                  <RangeFilterCheckbox />
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