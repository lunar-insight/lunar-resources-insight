import React, { useRef } from 'react';
import {Modal, ModalOverlay, Dialog, Heading} from 'react-aria-components';
import CloseButton from '../Button/CloseButton/CloseButton';
import { useMouseTrackingControl } from 'hooks/useMouseTrackingControl';
import './ModalOverlayContainer.scss';

interface ModalOverlayContainerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: React.ReactNode;
  modalId?: string;
}

const ModalOverlayContainer: React.FC<ModalOverlayContainerProps> = ({
  isOpen,
  onOpenChange,
  title,
  children,
  modalId
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useMouseTrackingControl(isOpen, modalId || `modal-${title.toLowerCase().replace(/\s+/g, '-')}`);

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <ModalOverlay 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      className="modal-overlay-container"
    >
      <Modal 
        className="modal-overlay-container__modal"
      >
        <Dialog ref={modalRef} className='modal-overlay-container__modal__dialog'>
          <div className='modal-overlay-container__modal__dialog__heading'>
            <Heading slot="title" className='modal-overlay-container__modal__dialog__heading__title'>{title}</Heading>
            <CloseButton 
              onPress={handleClose} 
              className='modal-overlay-container__modal__dialog__heading__close-button'
            />
          </div>
          <div className='modal-overlay-container__modal__dialog__content'>
            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ModalOverlayContainer;

