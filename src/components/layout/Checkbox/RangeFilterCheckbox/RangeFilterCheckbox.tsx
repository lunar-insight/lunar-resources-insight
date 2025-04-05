import React, { useState } from 'react';
import { Checkbox, Label } from 'react-aria-components';
import './RangeFilterCheckbox.scss';
import { useLayerContext } from 'utils/context/LayerContext';

interface RangeFilterCheckboxProps {
  layerId?: string;
}

export const RangeFilterCheckbox: React.FC<RangeFilterCheckboxProps> = ({ layerId }) => {
  const [isChecked, setIsChecked] = useState(false);
  const { updateLayerRangeFilter } = useLayerContext();

  if (!layerId) {
    return (
      <div className="range-filter-checkbox-container">
        <Checkbox isDisabled className="range-filter-checkbox">
          {({ isSelected }) => (
            <>
              <div className='checkbox'>
                {isSelected && (
                  <svg viewBox="0 0 18 18">
                    <polyline points="1 9 7 14 17 4" />
                  </svg>
                )}
              </div>
              <Label>Filter values outside range</Label>
            </>
          )}
        </Checkbox>
      </div>
    );
  }

  const handleChange = (isSelected: boolean) => {
    setIsChecked(isSelected);
    updateLayerRangeFilter(layerId, isSelected);
  };

  return (
    <div className="range-filter-checkbox-container">
      <Checkbox
        isSelected={isChecked}
        onChange={handleChange}
        className="range-filter-checkbox"
      >
        {({ isSelected }) => (
          <>
            <div className="checkbox">
              {isSelected && (
                <svg viewBox="0 0 18 18">
                  <polyline points="1 9 7 14 17 4" />
                </svg>
              )}
            </div>
            <Label>Filter values outside range</Label>
          </>
        )}
      </Checkbox>
    </div>
  );
};