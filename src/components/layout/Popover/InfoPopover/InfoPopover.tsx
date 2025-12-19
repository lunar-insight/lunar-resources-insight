import React, { useRef, useEffect, useState } from 'react';
import { Popover, Dialog, Heading } from 'react-aria-components';
import { useTextScramble } from '../../../../hooks/useTextScramble';
import styles from './InfoPopover.module.scss';

interface InfoPopoverProps {
  title: string;
  body: string;
  isOpen?: boolean;
}

export const InfoPopover: React.FC<InfoPopoverProps> = ({ title, body, isOpen = false }) => {
  const { displayText, scrambleIndices, revealedCount } = useTextScramble(body, {
    enabled: isOpen,
    duration: 1800,
    charactersPerFrame: 2
  });

  const measureRef = useRef<HTMLParagraphElement>(null);
  const [calculatedHeight, setCalculatedHeight] = useState<number | null>(null);

  // Calculate height when popover opens
  useEffect(() => {
    if (isOpen && measureRef.current) {
      const height = measureRef.current.offsetHeight;
      setCalculatedHeight(height);
    }
  }, [isOpen, body]);

  // Create a set of revealed scramble indices for fast lookup
  const revealedIndicesSet = new Set(scrambleIndices.slice(0, revealedCount));

  // Render text with individual character styling
  const renderStyledText = () => {
    return displayText.split('').map((char, index) => {
      // Handle line breaks
      if (char === '\n') {
        return <br key={index} />;
      }

      const isScrambleableChar = scrambleIndices.includes(index);
      const isRevealed = revealedIndicesSet.has(index);
      const shouldBeGray = isScrambleableChar && !isRevealed;

      return (
        <span
          key={index}
          className={shouldBeGray ? styles.scrambledChar : styles.revealedChar}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <Popover className={styles.infoPopover} placement="bottom">
      <Dialog className={styles.dialog}>
        <Heading className={styles.title}>{title}</Heading>
        {/* Hidden element to measure final height */}
        <p
          ref={measureRef}
          className={styles.measureBody}
          aria-hidden="true"
        >
          {body.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < body.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
        {/* Visible animated text with fixed height */}
        <p
          className={styles.body}
          style={calculatedHeight ? { height: `${calculatedHeight}px` } : undefined}
        >
          {renderStyledText()}
        </p>
      </Dialog>
    </Popover>
  );
};
