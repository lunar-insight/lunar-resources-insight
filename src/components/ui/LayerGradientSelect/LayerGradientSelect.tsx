import './LayerGradientSelect.scss'
import React, { useState, useEffect, useRef } from 'react'
import { Select, Button, Label, ListBox, ListBoxItem, Popover, SelectValue, ListBoxSection, Header } from "react-aria-components";
import { useLayerContext } from 'utils/context/LayerContext';
import { layerStatsService } from '../../../services/LayerStatsService';
import { getFormattedColormaps, getGradientPreviewUrl } from '../../../geoConfigExporter';

interface Gradient {
  category: string;
  label: string;
  value: string;
}

interface LayerGradientSelectProps {
  layerId: string;
}

const LayerGradientSelect: React.FC<LayerGradientSelectProps> = ({ layerId }) => {
  const { updateStyle } = useLayerContext();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number>(0);
  const [selectedLayerGradient, setSelectedLayerGradient] = useState<string>('gray');

  // When the component mount
  useEffect(() => {
    setSelectedLayerGradient('gray');
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      if (buttonRef.current) {
        setButtonWidth(buttonRef.current.offsetWidth);
      }
    };

    // Initial measurement
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    if (buttonRef.current) {
      resizeObserver.observe(buttonRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const gradients = getFormattedColormaps();

  const handleGradientChange = (selectedValue: string) => {
    try {
      const stats = layerStatsService.getLayerStats(layerId);

      updateStyle(layerId, {
        type: selectedValue,
        colors: [],
        min: stats.min,
        max: stats.max
      });
      setSelectedLayerGradient(selectedValue);
    } catch (error) {
      console.error('Error when loading gradient:', error);
    }
  };

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

  return (
    <Select
      className="layer-gradient-select"
      onSelectionChange={(value) => handleGradientChange(value.toString())}
      defaultSelectedKey="gray"
    >
      <Label>Select a gradient</Label>
      <Button 
        ref={buttonRef}
        className="layer-gradient-select__button"
        style={{
          '--selected-layer-gradient': `url('${getGradientPreviewUrl(selectedLayerGradient, buttonWidth)}')`,
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
                    backgroundImage: `url('${getGradientPreviewUrl(gradient.value, buttonWidth)}')`
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