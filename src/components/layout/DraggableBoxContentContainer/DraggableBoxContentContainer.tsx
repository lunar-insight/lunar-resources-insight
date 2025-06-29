import './DraggableBoxContentContainer.scss';
import React, { useRef, useState, useEffect } from 'react';
import { useDialog } from '@react-aria/dialog';
import { useMove } from '@react-aria/interactions';
import CloseButton from '../Button/CloseButton/CloseButton';
import { pointValueService } from '../../../services/PointValueService';

export interface DraggableBoxContentContainerProps {
  className?: string;
  children?: React.ReactNode;
  height?: number;
  width?: number;
  style?: React.CSSProperties;
  title?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  boundaryRef: React.RefObject<HTMLDivElement>;
}

interface ViewerContainerSize {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
}

export const DraggableBoxContentContainer: React.FC<DraggableBoxContentContainerProps> = ({
  className = '',
  children,
  width,
  height,
  style,
  title,
  isOpen,
  onClose,
  boundaryRef,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);
  const [viewerContainerSize, setViewerContainerSize] = useState<ViewerContainerSize>({
    x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 
  });
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

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

  const { moveProps } = useMove({
    onMoveStart: () => {
      // Disable the mouse point fetch when drag
      pointValueService.disableMouseTracking();
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
      // Reactivate mouse point fetch after drag
      setTimeout(() => {
        pointValueService.enableMouseTracking();
      }, 100); // ms
    }
  });

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width && { width: `${width}px` }),
    ...(height && { height: `${height}px` }),
  };

  const containerStyle: React.CSSProperties = {
    ...inlineStyles,
    transform: `translate(${clampX(translation.x)}px, ${clampY(translation.y)}px)`,
    left: `${viewerContainerSize.left}px`,
    top: `${viewerContainerSize.top}px`,
    maxWidth: `${viewerContainerSize.width}px`,
    maxHeight: `${viewerContainerSize.height}px`,
  };

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);

      const timer = setTimeout(() => {
        dialogRef.current?.classList.add('draggable-box-content-container__visible');
      }, 50);

      return () => clearTimeout(timer);
    } else {
      dialogRef.current?.classList.remove('draggable-box-content-container__visible');

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <div 
      {...dialogProps} 
      ref={dialogRef} 
      className={`draggable-box-content-container ${className} ${!isVisible ? 'draggable-box-content-container__hidden' : ''}`}
      style={isVisible ? containerStyle : undefined}       
    >
      {title && (
        <div {...moveProps} className="draggable-box-content-container__move-area">
          <h3 {...titleProps} className="draggable-box-content-container__move-area__title">
            {title}
          </h3>
          <CloseButton
            onPress={onClose}
            className="draggable-box-content-container__move-area__close-button"
          />
        </div>
      )}
      
      <div className="draggable-box-content-container__content-area">
        {children}
      </div>
    </div>
  );
};

export default DraggableBoxContentContainer;