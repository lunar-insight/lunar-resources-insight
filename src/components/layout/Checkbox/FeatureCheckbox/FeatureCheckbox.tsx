import React, { useState } from 'react';
import { Checkbox, Label } from 'react-aria-components';
import './FeatureCheckbox.scss';

interface FeatureCheckboxProps {
  onChange?: (isChecked: boolean) => void;
  defaultChecked?: boolean;
}

export const FeatureCheckbox: React.FC<FeatureCheckboxProps> = ({
  onChange,
  defaultChecked = false
}) => {
  const [isChecked, setIsChecked] = useState(defaultChecked);

  const handleChange = (checked: boolean) => {
    setIsChecked(checked);
    onChange?.(checked);
  };

  return (
    <div className='feature-checkbox'>
      <Checkbox
        isSelected={isChecked}
        onChange={handleChange}
        className="feature-checkbox__input"
      >
        {({ isSelected }) => (
          <>
            <div className='feature-checkbox__indicator'>
              {isSelected && (
                <svg viewBox="0 0 18 18" className='feature-checkbox__icon'>
                  <polyline points="1 9 7 14 17 4" />
                </svg>
              )}
            </div>
            <Label className='feature-checkbox__label'>
              Show values on map hover
            </Label>
          </>
        )}
      </Checkbox>
    </div>
  );
};