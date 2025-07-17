import './DraggableContentContainer.scss';
import React, { useRef, useState, useEffect } from 'react';
import { useDialog } from '@react-aria/dialog';
import { useMove, usePress } from '@react-aria/interactions';
import { mergeProps } from '@react-aria/utils';
import CloseButton from '../Button/CloseButton/CloseButton';
import { useZIndex } from '../../../utils/ZIndexProvider';
import { pointValueService } from '../../../services/PointValueService';
import { useMouseTrackingControl } from 'hooks/useMouseTrackingControl';

export interface DraggableContentContainerProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  boundaryRef: React.RefObject<HTMLDivElement>;
  style?: React.CSSProperties;
  onFocus?: () => void;
  id?: string;
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
  style = {},
  onFocus,
  id = 'draggable-content-' + Math.random().toString(36).substring(2, 11),
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);
  const { bringToFront, getZIndex } = useZIndex();
  const [viewerContainerSize, setViewerContainerSize] = useState<ViewerContainerSize>({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
  const [translation, setTranslation] = useState({ x: 0, y: 0});
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useMouseTrackingControl(isDragging || isHovered, `draggable-content-${id}`);

  const updateSizes = () => {
    if (boundaryRef.current && dialogRef.current) {
      const viewerBounds = boundaryRef.current.getBoundingClientRect();

      setViewerContainerSize({
        x: viewerBounds.left,
        y: viewerBounds.top,
        width: viewerBounds.width,
        height: viewerBounds.height,
        left: viewerBounds.left,
        top: viewerBounds.top,
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

  const handleBringToFront = (e?: any) => {
    // Prevent firing when clicking on buttons
    if (e && (e.target as HTMLElement).closest('button')) {
      return;
    }
    
    bringToFront(id, 'content-container');
    onFocus?.();
  };

  const { moveProps } = useMove({
    onMoveStart: () => {
      setIsDragging(true);
      handleBringToFront();
    },
    onMove: (moveEvent) => {
      requestAnimationFrame(() => {
        setTranslation(({ x, y }) => {
          const newX = clampX(x + moveEvent.deltaX);
          const newY = clampY(y + moveEvent.deltaY);
          return { x: newX, y: newY };
        });
      });
    },
    onMoveEnd: () => {
      setTimeout(() => {
        setIsDragging(false);
      }, 100);
    }
  });

  // Simple click without dragging
  const { pressProps } = usePress({
    onPressStart: handleBringToFront,
  });

  const titleBarProps = mergeProps(moveProps, pressProps);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  }

  const zIndex = getZIndex(id, 'content-container');

  const containerStyle: React.CSSProperties = {
    transform: `translate(${clampX(translation.x)}px, ${clampY(translation.y)}px)`,
    left: `${viewerContainerSize.left}px`,
    top: `${viewerContainerSize.top}px`,
    maxWidth: `${viewerContainerSize.width}px`,
    maxHeight: `${viewerContainerSize.height}px`,
    zIndex,
    ...style,
  };

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);

      const timer = setTimeout(() => {
        dialogRef.current?.classList.add('draggable-content-container__visible');
        // Foreground when opening
        bringToFront(id, 'content-container');
      }, 50);

      return () => clearTimeout(timer);
    } else {
      dialogRef.current?.classList.remove('draggable-content-container__visible');

      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsHovered(false);
        setIsDragging(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isOpen, id, bringToFront]);

  return (
    <div 
      {...dialogProps} 
      {...pressProps}
      ref={dialogRef} 
      className={`draggable-content-container ${!isVisible ? 'draggable-content-container__hidden' : ''}`}
      style={isVisible ? containerStyle : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        {...titleBarProps}
        className="draggable-content-container__move-area"
      >
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