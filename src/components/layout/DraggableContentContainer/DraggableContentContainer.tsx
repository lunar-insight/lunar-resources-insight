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
  const { dialogProps, titleProps } = useDialog({}, dialogRef);
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [viewerContainerSize, setViewerContainerSize] = useState<ViewerContainerSize>({ x: 0, y: 0, width: 0, height: 0 });
  const [draggableContainerSize, setDraggableContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSizes = () => {
      if (boundaryRef.current && dialogRef.current) {
        const viewerBounds = boundaryRef.current?.getBoundingClientRect();
        const viewerOffset = {
          x: viewerBounds.left + window.scrollX,
          y: viewerBounds.top + window.scrollY,
        };
        setViewerContainerSize({ 
          width: viewerBounds.width, 
          height: viewerBounds.height, 
          ...viewerOffset
        });
  
        const dialogRefBounds = dialogRef.current.getBoundingClientRect();
        setDraggableContainerSize({ 
          width: dialogRefBounds.width, 
          height: dialogRefBounds.height
        });
      }
    };

    updateSizes();
    // Handle internet explorer windows resizing for bounding box
    const handleResize = () => {
      updateSizes();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };

  }, [boundaryRef.current, dialogRef.current]);

  // Obtain dimension and position from Viewer Div
  const clampX = (posX: number) => Math.min(Math.max(posX, viewerContainerSize.x), viewerContainerSize.x + viewerContainerSize.width - draggableContainerSize.width);
  const clampY = (posY: number) => Math.min(Math.max(posY, viewerContainerSize.y), viewerContainerSize.y + viewerContainerSize.height - draggableContainerSize.height);

  // TODO: check edge case when the container go out of the screen on the right
  // happen after resizing the window, need to rezise the bounding div too
  const { moveProps } = useMove({
    
    onMoveStart: () => {
      // Can be used to prepare something when the move starts
    },

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

  const containerStyle: React.CSSProperties & { [key: string]: string } = {
    left: `${clampX(position.x)}px`,
    top: `${clampY(position.y)}px`,
  }

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