import React, { useState, useEffect } from 'react';
import {
  Button,
  ColorPicker,
  ColorArea,
  ColorSlider,
  ColorSwatch,
  ColorThumb,
  DialogTrigger,
  Popover,
  Dialog,
  Label,
  Input,
  SliderTrack,
  SliderOutput,
  parseColor,
  type Color
} from 'react-aria-components';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import styles from './FeatureColorButton.module.scss';

interface FeatureColorButtonProps {
  featureId: string;
  currentColor: string;
}

// Custom Hex Input component to handle real-time updates and proper typing behavior
const HexInput = ({ color, onChange }: { color: Color, onChange: (c: Color) => void }) => {
  const [inputValue, setInputValue] = useState(color.toString('hex'));
  const [lastColorHex, setLastColorHex] = useState(color.toString('hex'));

  // Update input value from props during render if changed externally (e.g. slider drag)
  const currentColorHex = color.toString('hex');
  if (currentColorHex !== lastColorHex) {
    setLastColorHex(currentColorHex);
    
    // Only overwrite user input if it semantically differs (e.g. dragging slider vs typing "fff")
    let shouldUpdate = true;
    try {
      const inputValStr = inputValue.startsWith('#') ? inputValue : '#' + inputValue;
      const parsedInput = parseColor(inputValStr);
      if (parsedInput.toString('hex') === currentColorHex) {
        shouldUpdate = false;
      }
    } catch {
      // Input currently invalid, force update if external color changed
    }

    if (shouldUpdate) {
      setInputValue(currentColorHex);
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    try {
      if (!val) return;
      const parsed = parseColor(val.startsWith('#') ? val : '#' + val);
      onChange(parsed);
    } catch {
      // Invalid color, ignore
    }
  };

  return (
    <div className={styles.colorField}>
      <Label className={styles.fieldLabel}>Hex</Label>
      <Input 
        className={styles.fieldInput} 
        value={inputValue} 
        onChange={onInputChange}
      />
    </div>
  );
};

export const FeatureColorButton: React.FC<FeatureColorButtonProps> = ({
  featureId,
  currentColor,
}) => {
  const { updateFeatureColor } = useFeaturesContext();
  const [isOpen, setIsOpen] = useState(false);
  const [color, setColor] = useState(parseColor(currentColor));

  // Sync local state when dialog opens or currentColor prop changes externally
  useEffect(() => {
    if (isOpen) {
      setColor(parseColor(currentColor));
    }
  }, [isOpen]);

  // Debounced update to global context
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if color actually changed to avoid redundant updates
      if (color.toString('hexa') !== parseColor(currentColor).toString('hexa')) {
        updateFeatureColor(featureId, color.toString('hexa'));
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [color, featureId, updateFeatureColor, currentColor]);

  const handleColorChange = (newColor: Color) => {
    setColor(newColor);
  };

  return (
    <DialogTrigger onOpenChange={setIsOpen}>
      <Button
        aria-label="Change feature color"
        className={styles.colorButton}
      >
        <ColorSwatch
          color={parseColor(currentColor)}
          className={styles.colorSwatch}
        />
      </Button>

      <Popover className={styles.colorPickerPopover} placement="bottom start">
        <Dialog className={styles.dialog}>
          <ColorPicker
            value={color}
            onChange={handleColorChange}
          >
            <ColorArea
              colorSpace="hsb"
              xChannel="saturation"
              yChannel="brightness"
              className={styles.colorArea}
            >
              <ColorThumb />
            </ColorArea>

            <ColorSlider
              colorSpace="hsb"
              channel="hue"
              className={styles.colorSlider}
            >
              <Label className={styles.sliderLabel}>Hue</Label>
              <SliderOutput className={styles.sliderOutput}>
                {({ state }) => `${Math.round(state.getThumbValue(0))}°`}
              </SliderOutput>
              <SliderTrack className={styles.sliderTrack}>
                <ColorThumb />
              </SliderTrack>
            </ColorSlider>

            <ColorSlider
              channel="alpha"
              className={styles.colorSlider}
            >
              <Label className={styles.sliderLabel}>Alpha</Label>
              <SliderOutput className={styles.sliderOutput}>
                {({ state }) => `${Math.round(state.getThumbValue(0) * 100)}%`}
              </SliderOutput>
              <SliderTrack
                className={styles.sliderTrack}
                style={({ defaultStyle }) => ({
                  background: `${defaultStyle.background}, repeating-conic-gradient(#555 0% 25%, #444 0% 50%) 50% / 8px 8px`
                })}
              >
                <ColorThumb />
              </SliderTrack>
            </ColorSlider>

            <HexInput color={color} onChange={handleColorChange} />
          </ColorPicker>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
