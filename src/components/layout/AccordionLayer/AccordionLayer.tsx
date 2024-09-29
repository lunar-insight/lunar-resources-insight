import React, { useState } from 'react';
import { Button } from 'react-aria-components';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({ title, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="accordion-item">
      <h3>
        <Button
          onPress={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="accordion-header"
        >
          {title}
        </Button>
      </h3>
      <div className="accordion-content" style={{ display: isExpanded ? 'block' : 'none' }}>
        {children}
      </div>
    </div>
  );
};

interface AccordionLayerProps {
  items: AccordionItemProps[];
}

const AccordionLayer: React.FC<AccordionLayerProps> = ({ items }) => {
  return (
    <div className="accordion">
      {items.map((item, index) => (
        <AccordionItem key={index} title={item.title}>
          {item.children}
        </AccordionItem>
      ))}
    </div>
  );
};

export default AccordionLayer;