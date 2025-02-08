/**
 * Customizable slider component for selecting minimum and maximum values of the maps color ramp
 * @example
 * ```tsx
 * function Example() {
 *   let [value, setValue] = React.useState(25);
 *   return (
 *     <ColorRampSlider<number>
 *       label="Color Ramp Value"
 *       value={value}
 *       onChange={setValue}
 *     />
 *   );
 * }
 * ```
 * @param {number} value - Actual value
 * @param {(value: number) => void} onChange - Callback called when value changed
 */

import React from 'react';
import './ColorRampSlider.scss';
import {
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack
} from 'react-aria-components';

import type { SliderProps } from 'react-aria-components';

interface ColorRampSliderProps<T> extends SliderProps<T> {
  label?: string;
  thumbLabels?: string[];
}

function ColorRampSlider<T extends number | number[]>({ 
  label, 
  thumbLabels,
  className,
  ...props 
}: ColorRampSliderProps<T>) {
  return (
    <Slider className={`color-ramp-slider ${className || ''}`} {...props}>
      {label && <Label>{label}</Label>}
      <SliderOutput>
        {({ state }) =>
          state.values.map((_, i) =>
            state.getThumbValueLabel(i)
          ).join(' - ')}
      </SliderOutput>
      <SliderTrack>
        {({ state }) =>
          state.values.map((_, i) => (
            <SliderThumb 
              key={i}
              index={i}
              aria-label={thumbLabels?.[i]}
            />
          ))}
      </SliderTrack>
    </Slider>
  );
}

export { ColorRampSlider };