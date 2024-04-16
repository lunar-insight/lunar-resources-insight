import React from 'react'
import './ChemicalElementsSection.scss';
import { Button } from 'react-aria-components';

interface ChemicalElementsSectionProps {

}

const ChemicalElementsSection: React.FC<ChemicalElementsSectionProps> = () => {

  return (
    <Button className="chemical-section__open-periodic-table-button">Periodic Table</Button>
  )

};

export default ChemicalElementsSection;