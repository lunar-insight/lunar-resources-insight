import React, { useState } from 'react';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';
import ModalOverlayContainer from 'components/layout/ModalOverlayContainer/ModalOverlayContainer';
import LayersCatalog from 'components/navigation/submenu/LayersCatalog/LayersCatalog';
import { useZIndex } from 'utils/ZIndexProvider';

const MODAL_ID = 'layers-catalog-modal';

const LayersCatalogButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { registerModal, unregisterModal } = useZIndex();

  const handleClose = () => {
    setIsOpen(false);
    unregisterModal(MODAL_ID);
  };

  const handleOpen = () => {
    setIsOpen(true);
    registerModal(MODAL_ID);
  };

  return (
    <>
      <ViewerIconButton
        icon="table_view"
        ariaLabel="Layers Catalog"
        tooltipText="Layers catalog"
        onPress={handleOpen}
        tooltipPlacement="bottom"
      />

      <ModalOverlayContainer
        isOpen={isOpen}
        onOpenChange={handleClose}
        title="Layers Catalog"
        modalId={MODAL_ID}
      >
        <LayersCatalog />
      </ModalOverlayContainer>
    </>
  );
};

export default LayersCatalogButton;
