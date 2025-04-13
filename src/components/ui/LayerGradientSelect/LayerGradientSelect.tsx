import './LayerGradientSelect.scss'
import React, { useState, useEffect, useRef } from 'react'
import { Select, Button, Label, ListBox, ListBoxItem, Popover, SelectValue, ListBoxSection, Header } from "react-aria-components";
import { useLayerContext } from 'utils/context/LayerContext';
import { layerStatsService } from '../../../services/LayerStatsService';
import { getFormattedColormaps } from '../../../geoConfigExporter';
import { colormapService } from '../../../services/ColormapService';

interface Gradient {
  category: string;
  label: string;
  value: string;
}

interface LayerGradientSelectProps {
  layerId: string;
}

const LayerGradientSelect: React.FC<LayerGradientSelectProps> = ({ layerId }) => {
  const { updateStyle, getLayerStyle } = useLayerContext();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number>(0);
  const [selectedLayerGradient, setSelectedLayerGradient] = useState<string>('gray');

  // When the component mount
  useEffect(() => {
    const currentStyle = getLayerStyle(layerId);
    if (currentStyle?.type) {
      setSelectedLayerGradient(currentStyle.type);
    } else {
      setSelectedLayerGradient('gray');
    }
  }, [layerId, getLayerStyle]);

  useEffect(() => {
    const updateButtonWidth = () => {
      if (buttonRef.current) {
        setButtonWidth(buttonRef.current.offsetWidth);
      }
    };

    // Initial measurement
    updateButtonWidth();

    const resizeObserver = new ResizeObserver(updateButtonWidth);
    if (buttonRef.current) {
      resizeObserver.observe(buttonRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleGradientChange = (selectedValue: string) => {
    try {
      const stats = layerStatsService.getLayerStats(layerId);
      const currentStyle = getLayerStyle(layerId)

      updateStyle(layerId, {
        type: selectedValue,
        colors: [],
        min: currentStyle?.min !== undefined ? currentStyle.min : stats.min,
        max: currentStyle?.max !== undefined ? currentStyle.max : stats.max
      });
      setSelectedLayerGradient(selectedValue);
    } catch (error) {
      console.error('Error when loading gradient:', error);
    }
  };

  const gradients = getFormattedColormaps();

  if (gradients.length === 0) {
    console.error('No gradients available')
  }

  const groupedGradients = gradients.reduce<Record<string, Gradient[]>>((acc, gradient) => {
    if (!acc[gradient.category]) {
      acc[gradient.category] = [];
    }
    acc[gradient.category].push(gradient);
    return acc;
  }, {});

  const getGradientUrl  = (colormapName: string) => {
    return colormapService.getGradientUrl(colormapName);
  };

  return (
    <Select
      className="layer-gradient-select"
      onSelectionChange={(value) => handleGradientChange(value.toString())}
      defaultSelectedKey={selectedLayerGradient}
    >
      <Label>Select a gradient</Label>
      <Button 
        ref={buttonRef}
        className="layer-gradient-select__button"
        style={{
          '--selected-layer-gradient': `url('${getGradientUrl(selectedLayerGradient)}')`,
        } as React.CSSProperties}
      >
        <div className="layer-gradient-select__selected-value-wrapper">
          <SelectValue />  
        </div>
        <span className="layer-gradient-select__button-icon" aria-hidden="true">▼</span>
      </Button>
      <Popover 
        className="layer-gradient-select__popover"
        style={{ '--button-width': `${buttonWidth}px` } as React.CSSProperties}
      >
        <ListBox className="layer-gradient-select__list">
          {Object.entries(groupedGradients).map(([category, categoryGradients]) => (
            <ListBoxSection key={category}>
              <Header className="layer-gradient-select__section-header">
                {category}
              </Header>
              {categoryGradients.map((gradient) => (
                <ListBoxItem
                  key={gradient.value}
                  id={gradient.value}
                  textValue={gradient.label}
                  className="layer-gradient-select__list-box-item"
                  style={{
                    backgroundImage: `url('${getGradientUrl(gradient.value)}')`
                  }}
                >
                  {gradient.label}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
};

export default LayerGradientSelect;