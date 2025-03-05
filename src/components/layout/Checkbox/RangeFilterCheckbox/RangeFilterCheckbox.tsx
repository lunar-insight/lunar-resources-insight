import React from 'react';
import { Checkbox, CheckboxProps } from 'react-aria-components';
import './RangeFilterCheckbox.scss';

export function RangeFilterCheckbox({ children, ...props}: CheckboxProps) {
  return (
    <Checkbox {...props} className='range-filter-checkbox'>
      {({ isSelected, isIndeterminate }) => (
        <>
          <div className='checkbox'>
            {(isSelected || isIndeterminate) && (
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <polyline points="1 9 7 14 15 4" />
              </svg>
            )}
          </div>
          <span>Hide areas out of range</span>
        </>
      )}
      
    </Checkbox>
  );
}