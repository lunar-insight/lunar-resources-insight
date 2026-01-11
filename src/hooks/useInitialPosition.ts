import { useState, useEffect, RefObject } from 'react';

interface UseInitialPositionOptions {
  dialogRef: RefObject<HTMLDivElement>;
  boundaryRef: RefObject<HTMLDivElement>;
  isOpen: boolean;
  cascadeIndex: number;
  hasBeenPositioned: boolean;
}

interface Position {
  x: number;
  y: number;
}

const CASCADE_OFFSET = 40; // pixels offset per window
const MAX_CASCADE_COUNT = 8; // reset after 8 windows

export const useInitialPosition = (
  options: UseInitialPositionOptions
): Position | null => {
  const { dialogRef, boundaryRef, isOpen, cascadeIndex, hasBeenPositioned } = options;
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    // Only calculate if:
    // 1. The window is open
    // 2. It hasn't been positioned yet
    // 3. We haven't calculated the position yet
    if (!isOpen || hasBeenPositioned || position !== null) {
      return;
    }

    // Wait for DOM to be ready
    const calculatePosition = () => {
      if (!dialogRef.current || !boundaryRef.current) {
        // Retry on next frame
        requestAnimationFrame(calculatePosition);
        return;
      }

      const dialogRect = dialogRef.current.getBoundingClientRect();
      const boundaryRect = boundaryRef.current.getBoundingClientRect();

      // Calculate centered position
      const centerX = (boundaryRect.width - dialogRect.width) / 2;
      const centerY = (boundaryRect.height - dialogRect.height) / 2;

      // Apply cascade offset
      const effectiveCascadeIndex = cascadeIndex % MAX_CASCADE_COUNT;
      const cascadeOffsetValue = effectiveCascadeIndex * CASCADE_OFFSET;

      const finalX = centerX + cascadeOffsetValue;
      const finalY = centerY + cascadeOffsetValue;

      setPosition({ x: finalX, y: finalY });
    };

    // Start calculation immediately
    requestAnimationFrame(calculatePosition);
  }, [isOpen, hasBeenPositioned, cascadeIndex, position, dialogRef, boundaryRef]);

  // Reset position when window is closed
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
    }
  }, [isOpen]);

  return position;
};
