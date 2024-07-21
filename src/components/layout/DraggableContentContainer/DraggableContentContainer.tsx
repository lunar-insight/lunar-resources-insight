import './DraggableContentContainer.scss';
import React, { useRef, useState, useEffect } from 'react';
import { useDialog } from '@react-aria/dialog';
import { useMove } from '@react-aria/interactions';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../Tooltip/ButtonTooltip';

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
  const [viewerContainerSize, setViewerContainerSize] = useState<ViewerContainerSize>({ x: 0, y: 0, width: 0, height: 0 });
  const [draggableContainerSize, setDraggableContainerSize] = useState({ width: 0, height: 0 });

  const updateSizes = () => {
    if (boundaryRef.current && dialogRef.current) {
      const viewerBounds = boundaryRef.current.getBoundingClientRect();
      const dialogBounds = dialogRef.current.getBoundingClientRect();

      setViewerContainerSize({
        x: viewerBounds.left,
        y: viewerBounds.top,
        width: viewerBounds.width,
        height: viewerBounds.height,
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
  const clampX = (posX: number) => {
    const minX = viewerContainerSize.x;
    const maxX = viewerContainerSize.x + viewerContainerSize.width - draggableContainerSize.width;
    return Math.max(minX, Math.min(posX, maxX));
  };
        
  const clampY = (posY: number) => {
    const minY = viewerContainerSize.y;
    const maxY = viewerContainerSize.y + viewerContainerSize.height - draggableContainerSize.height;
    return Math.max(minY, Math.min(posY, maxY));
  };

  const { moveProps } = useMove({
  
    onMove: (moveEvent) => {
      setPosition(({ x, y }) => {
        x += moveEvent.deltaX;
        y += moveEvent.deltaY;
        //if (moveEvent.pointerType === 'keyboard') { // Dragging outside the container and using arrow keys (need testing to confirm)
        x = clampX(x);
        y = clampY(y);

        return { x, y };
      });
    },
    
    onMoveEnd: () => {
      setPosition(({ x, y }) => {
        // Clamp position on mouse up
        x = clampX(x);
        y = clampY(y);
        return { x, y };
      })
    },
  });
//const containerStyle: React.CSSProperties & { [key: string]: string } = {
  const containerStyle: React.CSSProperties = {
    left: `${clampX(position.x)}px`,
    top: `${clampY(position.y)}px`,
    //
    //maxWidth: `${viewerContainerSize.width * 0.9}px`,
    //maxHeight: `${viewerContainerSize.height * 0.9}px`,
    //
    maxWidth: `${viewerContainerSize.width}px`,
    maxHeight: `${viewerContainerSize.height}px`,
  };

  if (!isOpen) return null; // Linked to the SectionNavigation code

  return (
    <div 
      {...dialogProps} 
      ref={dialogRef} 
      className="draggable-content-container"
      style={containerStyle}       
    >
      <div {...moveProps} className="draggable-content-container__move-area">
        <h3 {...titleProps} className="draggable-content-container__move-area__title">{title}</h3>

        <TooltipTrigger>
          <Button onPress={onClose} aria-label='Close' className="draggable-content-container__move-area__close-button">
            <span className='material-symbols-outlined draggable-content-container__move-area__close-button__icon'>
              close
            </span>
          </Button>
          <ButtonTooltip placement='top'>
            Close
          </ButtonTooltip>
        </TooltipTrigger>



      </div>
      <div className="draggable-content-container__content-area">
        {children}
      </div>
    </div>
  )
}

export default DraggableContentContainer;