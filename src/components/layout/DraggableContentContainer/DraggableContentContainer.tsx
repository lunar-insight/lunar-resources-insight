import './DraggableContentContainer.scss';
import React, { useRef, useState, useEffect } from 'react';
import { useDialog } from '@react-aria/dialog';
import { useMove } from '@react-aria/interactions';
import CloseButton from '../Button/CloseButton/CloseButton';

export interface DraggableContentContainerProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  boundaryRef: React.RefObject<HTMLDivElement>,
}

interface ViewerContainerSize {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
}

export const DraggableContentContainer: React.FC<DraggableContentContainerProps> = ({
  title,
  children,
  isOpen,
  onClose,
  boundaryRef,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [viewerContainerSize, setViewerContainerSize] = useState<ViewerContainerSize>({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
  const [draggableContainerSize, setDraggableContainerSize] = useState({ width: 0, height: 0 });
  const [translation, setTranslation] = useState({ x: 0, y: 0});
  const [isVisible, setIsVisible] = useState(false);

  const updateSizes = () => {
    if (boundaryRef.current && dialogRef.current) {
      const viewerBounds = boundaryRef.current.getBoundingClientRect();
      const dialogBounds = dialogRef.current.getBoundingClientRect();

      setViewerContainerSize({
        x: viewerBounds.left,
        y: viewerBounds.top,
        width: viewerBounds.width,
        height: viewerBounds.height,
        left: viewerBounds.left,
        top: viewerBounds.top,
      });

      setDraggableContainerSize({
        width: dialogBounds.width,
        height: dialogBounds.height
      });
    }
  };

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateSizes, 0);
    });

    if (boundaryRef.current) {
      resizeObserver.observe(boundaryRef.current);
    }

    window.addEventListener('resize', updateSizes);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSizes);
    };
  }, [boundaryRef.current, dialogRef.current]);

  // Obtain dimension and position from Viewer Div

  const clampX = (translateX: number) => {
    if (!boundaryRef.current || !dialogRef.current) return translateX;
    const boundaryRect = boundaryRef.current.getBoundingClientRect();
    const dialogRect = dialogRef.current.getBoundingClientRect();
    const minX = 0;
    const maxX = boundaryRect.width - dialogRect.width;
    return Math.max(minX, Math.min(translateX, maxX));
  };
  
  const clampY = (translateY: number) => {
    if (!boundaryRef.current || !dialogRef.current) return translateY;
    const boundaryRect = boundaryRef.current.getBoundingClientRect();
    const dialogRect = dialogRef.current.getBoundingClientRect();
    const minY = 0;
    const maxY = boundaryRect.height - dialogRect.height;
    return Math.max(minY, Math.min(translateY, maxY));
  };

  //if (moveEvent.pointerType === 'keyboard') { // Dragging outside the container and using arrow keys (need testing to confirm)

  const { moveProps } = useMove({
  
    onMove: (moveEvent) => {
      requestAnimationFrame(() => {
        setTranslation(({ x, y }) => {
          const newX = clampX(x + moveEvent.deltaX);
          const newY = clampY(y + moveEvent.deltaY);
          return { x: newX, y: newY };
        });
      });
    },
    

  });
//const containerStyle: React.CSSProperties & { [key: string]: string } = {
  const containerStyle: React.CSSProperties = {
    transform: `translate(${clampX(translation.x)}px, ${clampY(translation.y)}px)`,
    left: `${viewerContainerSize.left}px`,
    top: `${viewerContainerSize.top}px`,
    // To add security limit with 0.9:
    //maxWidth: `${viewerContainerSize.width * 0.9}px`,
    //maxHeight: `${viewerContainerSize.height * 0.9}px`,
    //
    maxWidth: `${viewerContainerSize.width}px`,
    maxHeight: `${viewerContainerSize.height}px`,
  };

  
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);

      const timer = setTimeout(() => {
        dialogRef.current?.classList.add('draggable-content-container__visible');
      }, 50);

      return () => clearTimeout(timer);
    } else {
      dialogRef.current?.classList.remove('draggable-content-container__visible');

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null; // Linked to the SectionNavigation code

  return (
    <div 
      {...dialogProps} 
      ref={dialogRef} 
      className="draggable-content-container"
      style={containerStyle}       
    >
      <div {...moveProps} className="draggable-content-container__move-area">
        <h3 {...titleProps} className="draggable-content-container__move-area__title">{title}</h3>

        <CloseButton
          onPress={onClose}
          className="draggable-content-container__move-area__close-button"
        />

      </div>
      <div className="draggable-content-container__content-area">
        {children}
      </div>
    </div>
  )
}

export default DraggableContentContainer;