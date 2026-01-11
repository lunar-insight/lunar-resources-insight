import React from 'react';

export const ThreePointCircleIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="10.5" cy="10.5" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="10.5" cy="2.5" r="2" fill="currentColor" />
      <circle cx="17.43" cy="14.5" r="2" fill="currentColor" />
      <circle cx="3.57" cy="14.5" r="2" fill="currentColor" />
    </svg>
  );
};
