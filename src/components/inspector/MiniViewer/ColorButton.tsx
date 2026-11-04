import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import styles from './MiniViewer.module.scss';

export type ColorState = 'gray' | 'viridis' | 'map';

const COLOR_NAMES: Record<ColorState, string> = {
  gray: 'gray',
  viridis: 'viridis',
  map: 'the colors of the map',
};

const GRADIENT_STOPS = 8;

/** A CSS gradient through a 256-entry color table. */
export function tableGradient(table: Uint8Array, direction: 'to right' | 'to top'): string {
  const stops = Array.from({ length: GRADIENT_STOPS }, (_, i) => {
    const at = Math.round((i / (GRADIENT_STOPS - 1)) * 255) * 4;
    return `rgb(${table[at]}, ${table[at + 1]}, ${table[at + 2]})`;
  });
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

interface ColorButtonProps {
  current: ColorState;
  /** The states to cycle through. */
  order: ColorState[];
  /** The current colors. */
  table: Uint8Array;
  onChange: (next: ColorState) => void;
}

/** Shows a swatch of the current colors. A press moves to the next, with no request. */
export const ColorButton: React.FC<ColorButtonProps> = ({ current, order, table, onChange }) => {
  const next = order[(order.indexOf(current) + 1) % order.length];
  const label = next === current
    ? `Colors: ${COLOR_NAMES[current]}`
    : `Colors: ${COLOR_NAMES[current]}. Press for ${COLOR_NAMES[next]}`;
  return (
    <TooltipTrigger delay={400}>
      <Button aria-label={label} className={`${styles.tool} ${styles.colorTool}`} onPress={() => onChange(next)}>
        <span className={styles.swatch} style={{ background: tableGradient(table, 'to top') }} />
      </Button>
      <ButtonTooltip placement="top">{label}</ButtonTooltip>
    </TooltipTrigger>
  );
};
