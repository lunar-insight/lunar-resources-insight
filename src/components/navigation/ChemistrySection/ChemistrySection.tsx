import React, { useState, useEffect } from 'react'
import styles from './ChemistrySection.module.scss';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from '../../layout/ModalOverlayContainer/ModalOverlayContainer';
import PeriodicTable, { Element, ALL_ELEMENTS_FLAT } from '../submenu/PeriodicTable/PeriodicTable';
import Compound from '../submenu/Compound/Compound';
import { useLayerContext } from '../../../utils/context/LayerContext';
import { layersConfig } from '../../../geoConfigExporter';
import { FeatureCheckbox } from '../../layout/Checkbox/FeatureCheckbox/FeatureCheckbox';
import { pointValueService } from '../../../services/PointValueService';
import { useViewer } from '../../../utils/context/ViewerContext';
import { DraggableBoxContentContainer } from '../../layout/DraggableBoxContentContainer/DraggableBoxContentContainer';
import { Portal } from '../../ui/Portal/Portal';
import '../../layout/BoxContentContainer/MapHoverValuesBox.scss';
import { ResourceBarsVisualizer } from '../../viewer/ResourceBarsVisualizer/ResourceBarsVisualizer';
import { useBoundaryRef } from '../../reference/BoundaryRefProvider';
import { useZIndex } from '../../../utils/ZIndexProvider';

const ChemistrySection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompoundModalOpen, setIsCompoundModalOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<Set<number>>(new Set());
  const [showValueBox, setShowValueBox] = useState(false);
  const [hoverValues, setHoverValues] = useState<{[key: string]: number} | null>(null);
  const [allHoverValues, setAllHoverValues] = useState<{[key: string]: number} | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const boundaryRef = useBoundaryRef();
  const { addLayer, removeLayer, selectedLayers } = useLayerContext();
  const { registerModal, unregisterModal } = useZIndex();
  const { viewer } = useViewer();

  // Initialize the service with the viewer and selected layers
  useEffect(() => {
    pointValueService.setViewer(viewer);
  }, [viewer]);

  useEffect(() => {
    // Update the service with current selected layers (only chemical ones)
    const chemicalLayers = selectedLayers.filter(layerId => {
      const config = layersConfig.layers[layerId];
      return config?.category === 'chemical';
    });

    pointValueService.setSelectedLayers(chemicalLayers);
  }, [selectedLayers]);

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

  // Auto close value box when no elements are selected
  useEffect(() => {
    if (selectedElements.size === 0 && showValueBox) {
      handlePointFetchToggle(false);
    }
  }, [selectedElements.size, showValueBox]);

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
    registerModal('periodic-table-modal');
  };

  const handleClosePeriodicTable = () => {
    setIsModalOpen(false);
    unregisterModal('periodic-table-modal');
  };

  const handleOpenCompound = () => {
    setIsCompoundModalOpen(true);
    registerModal('compound-modal');
  };

  const handleCloseCompound = () => {
    setIsCompoundModalOpen(false);
    unregisterModal('compound-modal');
  }

  const handleElementSelection = (element: Element) => {
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

    const elementSelected = selectedElements.has(element.atomicNumber);

    if (!elementSelected) {
      // Add every layer available for that element
      availableLayers.forEach(([layerId, _]) => {
        addLayer(layerId);
      });
      setSelectedElements(prev => new Set(prev).add(element.atomicNumber));
    } else {
      // Delete layers from that element
      availableLayers.forEach(([layerId, _]) => {
        removeLayer(layerId);
      });

      setSelectedElements(prev => {
        const newSet = new Set(prev);
        newSet.delete(element.atomicNumber);
        return newSet;
      });
    }
  };

  const renderValueBoxContent = () => {
    if (isPaused) {
      return (
        <div>
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

  // selectedElements to table for PeriodicTable
  const selectedElementsArray = Array.from(selectedElements)
    .map(atomicNumber => {
      return ALL_ELEMENTS_FLAT.find(el => el.atomicNumber === atomicNumber);
    })
    .filter((el): el is Element => el !== undefined);

  return (
    <>
      <div className={styles.buttonsContainer}>
        <Button
          className={styles.openPeriodicTableButton}
          onPress={handleOpenPeriodicTable}
        >
          Open Periodic Table
        </Button>

        <Button
          className={styles.openCompoundButton}
          onPress={handleOpenCompound}
        >
          Open Compound
        </Button>
      </div>

      {selectedElements.size > 0 && (
        <div>
          <FeatureCheckbox
            checked={showValueBox}
            onChange={handlePointFetchToggle}
          />
        </div>
      )}

      <Portal>
        <DraggableBoxContentContainer
          className='map-hover-values-box'
          width={400}
          height={350}
          title="Element concentration"
          isOpen={showValueBox}
          onClose={() => handlePointFetchToggle(false)}
          boundaryRef={boundaryRef}
          id="element-concentration-box"
        >
          <div className='map-hover-values-box__content'>
            {renderValueBoxContent()}
          </div>
        </DraggableBoxContentContainer>
      </Portal>

      <ModalOverlayContainer
        isOpen={isModalOpen}
        onOpenChange={handleClosePeriodicTable}
        title="Periodic Table of Elements"
        modalId='periodic-table-modal'
      >
        <PeriodicTable 
          onElementSelect={handleElementSelection} 
          selectedElements={selectedElementsArray}  
        />
      </ModalOverlayContainer>

      <ModalOverlayContainer
        isOpen={isCompoundModalOpen}
        onOpenChange={handleCloseCompound}
        title='Chemical Compounds'
        modalId='compound-modal'
      >
        <Compound />
      </ModalOverlayContainer>
    </>
  );
};

export default ChemistrySection;