import React from 'react';
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

  // Create a set of revealed scramble indices for fast lookup
  const revealedIndicesSet = new Set(scrambleIndices.slice(0, revealedCount));

  // Render text with individual character styling
  const renderStyledText = () => {
    return displayText.split('').map((char, index) => {
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
        <p className={styles.body}>{renderStyledText()}</p>
      </Dialog>
    </Popover>
  );
};
