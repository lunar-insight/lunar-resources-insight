import React, { useState } from 'react'
import './ChemicalElementsSection.scss';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from './../../layout/ModalOverlayContainer/ModalOverlayContainer';
import PeriodicTable, { Element } from '../submenu/PeriodicTable/PeriodicTable'
import { GridListLayer, GridListLayerItem } from '../../layout/GridListLayerComponent/GridListLayerComponent';
import { useLayerContext } from '../../../utils/context/LayerContext';
import { layersConfig, mapServerWorkspaceName } from '../../../geoConfigExporter';


const ChemicalElementsSection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<(Element & { id: number })[]>([]);
  const { addLayer, removeLayer } = useLayerContext();

  const handleOpenPeriodicTable = () => {
    setIsModalOpen(true);
  };

  const handleClosePeriodicTable = () => {
    setIsModalOpen(false);
  };

  const handleElementSelection = (element: Element) => {
    setSelectedElements(prev => {
      const index = prev.findIndex(e => e.id === element.atomicNumber);

      // If clicked element on ptable is not on the list, its added in it
      if (index === -1) {
        const newElements = [...prev, { ...element, id: element.atomicNumber }];
        const layerName = layersConfig.chemicalElementLayer[element.name.toLowerCase()]['1'];
        const fullLayerName = `${mapServerWorkspaceName}:${layerName}`;
        addLayer(fullLayerName)
        return newElements;

      // If clicked element is already in the list (already selected), it's removed from the list
      } else {
        const newElements = prev.filter(e => e.id !== element.atomicNumber);
        const layerName = layersConfig.chemicalElementLayer[element.name.toLowerCase()]['1'];
        const fullLayerName = `${mapServerWorkspaceName}:${layerName}`;
        removeLayer(fullLayerName);
        return newElements;
      }
    });
  };

  const handleReorder = (newItems: (Element & { id: number })[]) => {
    setSelectedElements(newItems);
  }

  const handleRemoveElement = (id: number) => {
    setSelectedElements(prev => {
      const element = prev.find(e => e.id === id);
      if (element) {
        const layerName = layersConfig.chemicalElementLayer[element.name.toLowerCase()]['1'];
        const fullLayerName = `${mapServerWorkspaceName}:${layerName}`;
        removeLayer(fullLayerName);
      }
      return prev.filter(e => e.id !== id);
    });
  };

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
        {(item: Element & { id: number }) => (
          <GridListLayerItem 
            key={item.id}
            textValue={`${item.name} (${item.symbol})`}
            onRemove={() => handleRemoveElement(item.id)}
            accordionContent={
              <div>
                Description: {item.atomicNumber}
              </div>
            }  
          >
            {item.name} ({item.symbol})
          </GridListLayerItem>
        )}
      </GridListLayer>
    </>
  );
};

export default ChemicalElementsSection;