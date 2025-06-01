import React, { useState } from 'react';
import { Checkbox, Label } from 'react-aria-components';
import './FeatureCheckbox.scss';

export const FeatureCheckbox = () => {
  const [isChecked, setIsChecked] = useState(false);
// Todo find name css
  return (
    <div className='feature-checkbox'>
      <Checkbox
        isSelected={isChecked}
        onChange={setIsChecked}
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