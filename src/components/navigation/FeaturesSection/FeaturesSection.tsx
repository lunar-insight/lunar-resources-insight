import React, { useState } from 'react';
import { RadioGroup, Radio, Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../../layout/Tooltip/ButtonTooltip';
import { TwoPointCircleIcon } from '../../ui/DrawingIcons/TwoPointCircleIcon';
import { ThreePointCircleIcon } from '../../ui/DrawingIcons/ThreePointCircleIcon';
import styles from './FeaturesSection.module.scss';

// Define drawing tools configuration
const drawingTools = [
  { value: 'point', icon: 'point_scan', tooltip: 'Draw points', label: 'Point Drawing Tool' },
  { value: 'line', icon: 'diagonal_line', tooltip: 'Draw lines', label: 'Line Drawing Tool' },
  { value: 'polygon', icon: 'hexagon', tooltip: 'Draw polygons', label: 'Polygon Drawing Tool' },
  { value: 'circle', icon: 'circle', tooltip: 'Draw circles', label: 'Circle Drawing Tool' },
  {
    value: 'two-point-circle',
    customIcon: <TwoPointCircleIcon />,
    tooltip: 'Draw circle by two points',
    label: 'Two-Point Circle Tool'
  },
  {
    value: 'three-point-circle',
    customIcon: <ThreePointCircleIcon />,
    tooltip: 'Draw circle by three points',
    label: 'Three-Point Circle Tool'
  },
];

const FeaturesSection: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<string>('');

  return (
    <>
      {/* Drawing Tools Section */}
      <div className={styles.section}>
        <h3 className={styles.title}>Drawing Tools</h3>

        <div className={styles.toolsWrapper}>
          <RadioGroup
            value={selectedTool}
            onChange={setSelectedTool}
            className={styles.toolsContainer}
          >
            {drawingTools.map((tool) => (
              <Radio
                key={tool.value}
                value={tool.value}
                aria-label={tool.label}
                className={styles.drawingToolRadio}
              >
                {({ isSelected }) => (
                  <div
                    className={styles.radioButton}
                    data-selected={isSelected || undefined}
                    title={tool.tooltip}
                  >
                    {tool.customIcon ? (
                      tool.customIcon
                    ) : (
                      <span className={`material-symbols-outlined ${styles.icon}`}>
                        {tool.icon}
                      </span>
                    )}
                  </div>
                )}
              </Radio>
            ))}
          </RadioGroup>

          <div className={styles.separator}></div>

          <TooltipTrigger>
            <Button
              onPress={() => {}}
              aria-label="Upload Shape Tool"
              className={styles.uploadButton}
            >
              <span className={`material-symbols-outlined ${styles.icon}`}>upload</span>
            </Button>
            <ButtonTooltip placement="right">
              Upload Shape
            </ButtonTooltip>
          </TooltipTrigger>
        </div>
      </div>

      {/* Selection Frame Section */}
      <div className={styles.section}>
        <h3 className={styles.title}>Selected Features</h3>
        <div className={styles.selectionFrame}>
          <span className={styles.placeholder}>No features selected</span>
        </div>
      </div>
    </>
  );
};

export default FeaturesSection;
