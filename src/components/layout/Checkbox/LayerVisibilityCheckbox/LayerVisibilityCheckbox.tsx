import React from 'react';
import { CheckboxProps, Checkbox } from 'react-aria-components';
import './LayerVisibilityCheckbox.scss';

export function LayerVisibilityCheckbox({ children, ...props }: CheckboxProps) {
  return (
    <Checkbox {...props} className='layer-checkbox'>
      {({ isSelected }) => (
        <>
          <div className="layer-checkbox__box">
            <span className="material-symbols-outlined layer-checkbox__box__icon">
              {isSelected ? 'visibility' : 'visibility_off'}
            </span>
          </div>
          {children}
        </>
      )}
    </Checkbox>
  );
}
