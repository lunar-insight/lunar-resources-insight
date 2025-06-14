/**
 * Customizable slider component for selecting minimum and maximum values of the maps color ramp
 * @see {@link https://react-spectrum.adobe.com/react-aria/Slider.html React Aria Slider Documentation}
 * @example
 * ```tsx
 * function Example() {
 *   let [value, setValue] = React.useState(25);
 *   return (
 *    <ColorRampSlider
 *      label="Color Ramp Values"
 *      defaultValue={[0, 10]}
 *      minValue={0}
 *      maxValue={100}
 *      absoluteMin={0}
 *      absoluteMax={100}
 *      step={1}
 *      thumbLabels={['start', 'end']}
 *      onChange={(values) => handleRampValueChange(fullLayerName, values as number[])}
 *    />
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
  SliderThumb,
  SliderTrack,
  Input,
  NumberField,
  LabelContext,
  useSlottedContext
} from 'react-aria-components';

import type { SliderProps } from 'react-aria-components';

interface ColorRampSliderProps<T> extends SliderProps<T> {
  label?: string;
  thumbLabels?: string[];
  absoluteMin?: number;
  absoluteMax?: number;
}

function ColorRampSlider<T extends number | number[]>({ 
  label, 
  thumbLabels,
  className,
  defaultValue,
  minValue,
  maxValue,
  absoluteMin,
  absoluteMax,
  ...props 
}: ColorRampSliderProps<T>) {
  const labelId = useSlottedContext(LabelContext)?.id;

  return (
    <div className={`color-ramp-slider-wrapper ${className || ''}`}>
      <Slider 
        className="color-ramp-slider"
        defaultValue={defaultValue}
        minValue={minValue}
        maxValue={maxValue}
        aria-label={label || "Color range selector"}
        orientation="horizontal"
        {...props}
      >
        {({ state }) => (
          <>
            {label && <Label>{label}</Label>}
            <div className='color-ramp-slider__inputs'>
              {state.values.map((_, i) => (
                <NumberField
                  key={i}
                  aria-labelledby={labelId}
                  value={state.values[i]}
                  onChange={(v) => state.setThumbValue(i, v)}
                >
                  <Label>{thumbLabels?.[i] || `Value ${i + 1}`}</Label>
                  <Input />
                </NumberField>
              ))}
            </div>
          
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
          </>
        )}
      </Slider>
      
      <div className="color-ramp-slider__absolute-values">
        {absoluteMin !== undefined && (
          <span className="color-ramp-slider__absolute-min">
            {absoluteMin.toFixed(3)}
          </span>
        )}
        
        {absoluteMax !== undefined && (
          <span className="color-ramp-slider__absolute-max">
            {absoluteMax.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}

export { ColorRampSlider };