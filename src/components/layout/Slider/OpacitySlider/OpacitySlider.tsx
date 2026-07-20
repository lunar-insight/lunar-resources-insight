import React from 'react';
import { Label, Slider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components';
import './OpacitySlider.scss';
import type { SliderProps } from 'react-aria-components';

interface OpacitySliderProps extends SliderProps<number> {
  label?: string;
}

function OpacitySlider({ label = 'Opacity', ...props }: OpacitySliderProps) {
  return (
    <Slider defaultValue={100} {...props}>
      <Label>
        {label}
      </Label>
      <SliderOutput />
      <SliderTrack>
        <SliderThumb />
      </SliderTrack>
    </Slider>
  )
}

export default OpacitySlider;