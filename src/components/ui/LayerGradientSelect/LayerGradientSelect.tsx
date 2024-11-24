import './LayerGradientSelect.scss'
import React, { useState, useEffect, useRef } from 'react'
import { Select, Button, Label, ListBox, ListBoxItem, Popover, SelectValue, Section, Header } from "react-aria-components";
import { colorbrewer } from '../../../utils/constants/colorbrewer.constants.js'

interface Gradient {
  category: string;
  label: string;
  value: string;
  dataClasses: number;
}

const LayerGradientSelect = () => {

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonWidth, setButtonWidth] = useState<number>(0);

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

  const allowedSchemes = {
    'Single hue': [
      'Blues', 'Greens', 'Greys', 'Oranges', 'Purples', 'Reds'
    ],
    'Multi-hue': [
      'BuGn', 'BuPu', 'GnBu', 'OrRd', 'PuBu', 'PuBuGn', 'PuRd', 'RdPu', 'YlGn', 'YlGnBu', 'YlOrBr', 'YlOrRd'
    ]
  } as const;

  const createGradient = (colors: string[]) => `linear-gradient(to right, ${colors.join(', ')})`;

  const generateGradients = () => {
    const gradientsList = [];

    for (const [category, schemes] of Object.entries(allowedSchemes)) {
      for (const schemeName of schemes) {
        const scheme = colorbrewer[schemeName];
    
        if (scheme) {
          const maxDataClasses = Math.max(...Object.keys(scheme).map(Number));
          const colors = scheme[maxDataClasses];
          gradientsList.push({
            category,
            label: `${schemeName}`,
            value: createGradient(colors as string[]),
            dataClasses: maxDataClasses
          });
        }
      }
    }

    return gradientsList.sort((a, b) => {
      const categoryOrder = Object.keys(allowedSchemes);
      const categoryCompare = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      if (categoryCompare !== 0) return categoryCompare;

      return a.label.localeCompare(b.label);
    });
  };

  const gradients = generateGradients();
  const [selectedLayerGradient, setSelectedLayerGradient] = useState<string>(gradients[0]?.value || '');

  if (gradients.length === 0) {
    return <div>No gradients available</div>;
  }

  const groupedGradients = gradients.reduce<Record<string, Gradient[]>>((acc, gradient) => {
    if (!acc[gradient.category]) {
      acc[gradient.category] = [];
    }
    acc[gradient.category].push(gradient);
    return acc;
  }, {});

  // TODO move to SCSS file
  // TODO only show the max gradient
  // TODO add two categories name in the dropdown list : "Single hue" and "Multi-hue"
  // TODO add a dynamic text on the left or right to know what we have selected (react aria components?)

  return (
    <Select
      className="layer-gradient-select"
      onSelectionChange={(value) => setSelectedLayerGradient(value.toString())}
      defaultSelectedKey={gradients[0].value}
    >
      <Label>Select a gradient</Label>
      <Button 
        ref={buttonRef}
        className="layer-gradient-select__button"
        style={{
          '--selected-layer-gradient': selectedLayerGradient,
        } as React.CSSProperties}
      >
        <SelectValue />
        <span aria-hidden="true">▼</span>
      </Button>
      <Popover 
        className="layer-gradient-select__popover"
        style={{ '--button-width': `${buttonWidth}px` } as React.CSSProperties}
      >
        <ListBox className="layer-gradient-select__list">
          {Object.entries(groupedGradients).map(([category, categoryGradients]: [string, Gradient[]]) => (
            <Section key={category}>
              <Header className="layer-gradient-select__section-header">
                {category}
              </Header>
              {categoryGradients.map((gradient: Gradient) => (

                <ListBoxItem
                  key={gradient.value}
                  id={gradient.value}
                  textValue={gradient.label}
                  className="layer-gradient-select__list-box-item"
                  style={{
                    background: gradient.value
                  }}
                >
                  {gradient.label}
                </ListBoxItem>
              ))}
            </Section>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
};

export default LayerGradientSelect;