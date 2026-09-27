import React, { useState } from 'react';
import { Checkbox } from 'components/layout/Checkbox/Checkbox/Checkbox';
import './RangeFilterCheckbox.scss';
import { useLayerContext } from 'utils/context/LayerContext';

interface RangeFilterCheckboxProps {
  layerId?: string;
}

export const RangeFilterCheckbox: React.FC<RangeFilterCheckboxProps> = ({ layerId }) => {
  const [isChecked, setIsChecked] = useState(false);
  const { updateLayerRangeFilter } = useLayerContext();

  const handleChange = (isSelected: boolean) => {
    if (!layerId) return;
    setIsChecked(isSelected);
    updateLayerRangeFilter(layerId, isSelected);
  };

  return (
    <div className="range-filter-checkbox-container">
      <Checkbox
        label="Filter values outside range"
        isSelected={isChecked}
        onChange={handleChange}
        isDisabled={!layerId}
        className="range-filter-checkbox"
      />
    </div>
  );
};
