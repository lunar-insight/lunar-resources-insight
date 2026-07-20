import { useState, useEffect, useRef, useMemo } from 'react';

interface UseTextScrambleOptions {
  enabled?: boolean;           // Enable/disable animation
  duration?: number;           // Total animation duration (ms)
  charactersPerFrame?: number; // Reveal speed
  scrambleChars?: string;      // Characters used for scrambling
}

interface UseTextScrambleReturn {
  displayText: string;         // Text to display
  isAnimating: boolean;        // Animation state
  revealedCount: number;       // Number of characters revealed so far
  scrambleIndices: number[];   // Indices of scramble-able characters
  reset: () => void;           // Reset animation function
}

const DEFAULT_OPTIONS = {
  enabled: true,
  duration: 1800,
  charactersPerFrame: 2,
  scrambleChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
};

export const useTextScramble = (
  targetText: string,
  options: UseTextScrambleOptions = {}
): UseTextScrambleReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [displayText, setDisplayText] = useState(targetText);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Pre-calculate which indices are scramble-able (everything except spaces and line breaks)
  const scrambleIndices = useMemo(() => {
    return targetText
      .split('')
      .map((char, i) => /\S/.test(char) ? i : -1)
      .filter(i => i !== -1);
  }, [targetText]);

  const getRandomChar = () => {
    return opts.scrambleChars.charAt(
      Math.floor(Math.random() * opts.scrambleChars.length)
    );
  };

  const generateScrambledText = (revealedCount: number) => {
    const chars = targetText.split('');
    const revealedIndices = new Set(scrambleIndices.slice(0, revealedCount));

    scrambleIndices.forEach(index => {
      if (!revealedIndices.has(index)) {
        chars[index] = getRandomChar();
      }
    });

    return chars.join('');
  };

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / opts.duration, 1);
    const currentRevealedCount = Math.floor(progress * scrambleIndices.length);

    if (progress < 1) {
      setDisplayText(generateScrambledText(currentRevealedCount));
      setRevealedCount(currentRevealedCount);
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Animation complete
      setDisplayText(targetText);
      setRevealedCount(scrambleIndices.length);
      setIsAnimating(false);
    }
  };

  const reset = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    startTimeRef.current = 0;
    setIsAnimating(false);
    setRevealedCount(0);
    setDisplayText(targetText);
  };

  useEffect(() => {
    if (opts.enabled && targetText) {
      setIsAnimating(true);
      setRevealedCount(0);
      startTimeRef.current = 0;

      // Immediately show fully scrambled text
      setDisplayText(generateScrambledText(0));

      // Start animation immediately (no setTimeout)
      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      setDisplayText(targetText);
      setIsAnimating(false);
      setRevealedCount(scrambleIndices.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetText, opts.enabled]);

  return { displayText, isAnimating, revealedCount, scrambleIndices, reset };
};
