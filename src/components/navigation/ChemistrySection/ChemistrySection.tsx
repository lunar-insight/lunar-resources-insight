import React, { useState, useEffect, useMemo } from 'react'
import styles from './ChemistrySection.module.scss';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from 'components/layout/ModalOverlayContainer/ModalOverlayContainer';
import PeriodicTable, { ALL_ELEMENTS_FLAT } from '../submenu/PeriodicTable/PeriodicTable';
import { Element } from 'constants/periodicTableData';
import Compound from '../submenu/Compound/Compound';
import DerivedIndices from '../submenu/DerivedIndices/DerivedIndices';
import { useLayerContext } from 'utils/context/LayerContext';
import { layersConfig } from 'geoConfigExporter';
import { pointValueService } from 'services/PointValueService';
import { useScannerContext } from 'utils/context/ScannerContext';
import { useViewer } from 'utils/context/ViewerContext';
import { DraggableBoxContentContainer } from 'components/layout/DraggableBoxContentContainer/DraggableBoxContentContainer';
import { Portal } from 'components/ui/Portal/Portal';
import './MapHoverValuesBox.scss';
import { ResourceBarsVisualizer } from 'components/viewer/ResourceBarsVisualizer/ResourceBarsVisualizer';
import { useBoundaryRef } from 'components/reference/BoundaryRefProvider';
import { useZIndex } from 'utils/ZIndexProvider';

const ChemistrySection: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompoundModalOpen, setIsCompoundModalOpen] = useState(false);
  const [isDerivedIndicesModalOpen, setIsDerivedIndicesModalOpen] = useState(false);
  const [hoverValues, setHoverValues] = useState<{[key: string]: number} | null>(null);
  const [allHoverValues, setAllHoverValues] = useState<{[key: string]: number} | null>(null);
  const [compoundHoverValues, setCompoundHoverValues] = useState<{[key: string]: number} | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const boundaryRef = useBoundaryRef();
  const { addLayer, removeLayer, selectedLayers } = useLayerContext();
  const { registerModal, unregisterModal } = useZIndex();
  const { viewer } = useViewer();
  const {
    showElementScanner, toggleElementScanner,
    showCompoundScanner, toggleCompoundScanner,
    showDerivedIndexScanner, toggleDerivedIndexScanner,
  } = useScannerContext();

  const selectedChemicalLayerIds = useMemo(
    () => selectedLayers.filter(id => layersConfig.layers[id]?.category === 'chemical'),
    [selectedLayers]
  );

  const selectedCompoundLayerIds = useMemo(
    () => selectedLayers.filter(id => layersConfig.layers[id]?.category === 'compound'),
    [selectedLayers]
  );

  const selectedElements = useMemo(() => {
    const atomicNumbers = new Set<number>();
    selectedChemicalLayerIds.forEach(layerId => {
      const config = layersConfig.layers[layerId];
      if (config?.element) {
        const element = ALL_ELEMENTS_FLAT.find(el => el.name.toLowerCase() === config.element);
        if (element) atomicNumbers.add(element.atomicNumber);
      }
    });
    return atomicNumbers;
  }, [selectedChemicalLayerIds]);

  // Initialize the service with the viewer and selected layers
  useEffect(() => {
    pointValueService.setViewer(viewer);
  }, [viewer]);

  useEffect(() => {
    pointValueService.setSelectedLayers([...selectedChemicalLayerIds, ...selectedCompoundLayerIds]);
  }, [selectedChemicalLayerIds, selectedCompoundLayerIds]);

  useEffect(() => {
    const eitherOpen = showElementScanner || showCompoundScanner;
    if (!eitherOpen) {
      pointValueService.stop();
      setHoverValues(null);
      setAllHoverValues(null);
      setCompoundHoverValues(null);
      setIsPaused(false);
      return;
    }

    pointValueService.start();
    const unsubscribe = pointValueService.onValuesUpdate((data) => {
      setIsPaused(data.isPaused || false);
      if (data.isPaused) {
        setHoverValues(null);
        setCompoundHoverValues(null);
        return;
      }
      if (showElementScanner) {
        const elementVals = Object.fromEntries(
          Object.entries(data.displayValues).filter(([id]) => selectedChemicalLayerIds.includes(id))
        );
        setHoverValues(elementVals);
        setAllHoverValues(data.allValues);
      }
      if (showCompoundScanner) {
        const compoundVals = Object.fromEntries(
          Object.entries(data.displayValues).filter(([id]) => selectedCompoundLayerIds.includes(id))
        );
        setCompoundHoverValues(compoundVals);
      }
    });
    return unsubscribe;
  }, [showElementScanner, showCompoundScanner, selectedChemicalLayerIds, selectedCompoundLayerIds]);

  // Auto close element scanner when all elements are deselected while scanner is open
  useEffect(() => {
    if (selectedElements.size === 0 && showElementScanner) {
      toggleElementScanner(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElements.size]);

  // Auto close compound scanner when all compounds are deselected while scanner is open
  useEffect(() => {
    if (selectedCompoundLayerIds.length === 0 && showCompoundScanner) {
      toggleCompoundScanner(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompoundLayerIds.length]);

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

  const handleOpenDerivedIndices = () => {
    setIsDerivedIndicesModalOpen(true);
    registerModal('derived-indices-modal');
  };

  const handleCloseDerivedIndices = () => {
    setIsDerivedIndicesModalOpen(false);
    unregisterModal('derived-indices-modal');
  };

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
    } else {
      // Delete layers from that element
      availableLayers.forEach(([layerId, _]) => {
        removeLayer(layerId);
      });
    }
  };

  const renderCompoundBoxContent = () => {
    if (isPaused) {
      return (
        <div>
          <p>⏸️ Scan paused</p>
          <small>Move the mouse on the globe to resume</small>
        </div>
      );
    }

    if (compoundHoverValues === null) {
      return <p>Hover over the map to scan resources</p>;
    }

    const presentIds = new Set(Object.keys(compoundHoverValues));
    const nodataLayerIds = selectedCompoundLayerIds.filter(id => !presentIds.has(id));

    return (
      <ResourceBarsVisualizer
        values={compoundHoverValues}
        nodataLayerIds={nodataLayerIds}
        width={270}
      />
    );
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

    if (hoverValues === null) {
      return <p>Hover over the map to scan resources</p>;
    }

    const presentIds = new Set(Object.keys(hoverValues));
    const nodataLayerIds = selectedChemicalLayerIds.filter(id => !presentIds.has(id));

    return (
      <ResourceBarsVisualizer
        values={hoverValues}
        allValues={allHoverValues ?? undefined}
        nodataLayerIds={nodataLayerIds}
        width={270}
        height={250}
      />
    );
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
        <div className={styles.buttonGroup}>
          <Button
            className={`${styles.sectionButton} ${styles.periodicTableButton}`}
            onPress={handleOpenPeriodicTable}
          >
            Periodic Table
          </Button>
          <p className={styles.buttonDescription}>
            Select chemical elements to overlay their surface abundance maps on the Moon.
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <Button
            className={`${styles.sectionButton} ${styles.compoundButton}`}
            onPress={handleOpenCompound}
          >
            Compound
          </Button>
          <p className={styles.buttonDescription}>
            A compound is a substance formed when two or more elements chemically bond. Explore how they appear as minerals in the lunar regolith.
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <Button
            className={`${styles.sectionButton} ${styles.derivedIndicesButton}`}
            onPress={handleOpenDerivedIndices}
          >
            Derived Indices
          </Button>
          <p className={styles.buttonDescription}>
            Ratios computed from oxide maps that highlight terrain types. Each index condenses multiple element layers into one.
          </p>
        </div>
      </div>

      <Portal>
        <DraggableBoxContentContainer
          className='map-hover-values-box'
          width={400}
          title="Element concentration"
          isOpen={showElementScanner}
          onClose={() => toggleElementScanner(false)}
          boundaryRef={boundaryRef}
          id="element-concentration-box"
        >
          <div className='map-hover-values-box__content'>
            {renderValueBoxContent()}
          </div>
        </DraggableBoxContentContainer>
      </Portal>

      <Portal>
        <DraggableBoxContentContainer
          width={400}
          title="Compound Scanner"
          isOpen={showCompoundScanner}
          onClose={() => toggleCompoundScanner(false)}
          boundaryRef={boundaryRef}
          id="compound-scanner-box"
          cascadeIndex={1}
        >
          <div className='map-hover-values-box__content'>
            {renderCompoundBoxContent()}
          </div>
        </DraggableBoxContentContainer>
      </Portal>

      <Portal>
        <DraggableBoxContentContainer
          width={400}
          title="Derived Index Scanner"
          isOpen={showDerivedIndexScanner}
          onClose={() => toggleDerivedIndexScanner(false)}
          boundaryRef={boundaryRef}
          id="derived-index-scanner-box"
          cascadeIndex={2}
        />
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

      <ModalOverlayContainer
        isOpen={isDerivedIndicesModalOpen}
        onOpenChange={handleCloseDerivedIndices}
        title='Derived Indices'
        modalId='derived-indices-modal'
      >
        <DerivedIndices />
      </ModalOverlayContainer>
    </>
  );
};

export default ChemistrySection;