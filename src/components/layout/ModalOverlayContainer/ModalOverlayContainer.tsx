import React, { useRef } from 'react';
import {Modal, ModalOverlay, Dialog, Heading} from 'react-aria-components';
import './ModalOverlayContainer.scss';

interface ModalOverlayContainerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: React.ReactNode;
}

const ModalOverlayContainer: React.FC<ModalOverlayContainerProps> = ({
  isOpen,
  onOpenChange,
  title,
  children
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

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

