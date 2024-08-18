import React, { useState, useRef } from 'react';
import { useGridList } from 'react-aria';
import { useListState } from 'react-stately';
import './PeriodicTable.scss';

interface Element {
  group: number;
  name: string;
  symbol: string;
  atomicNumber: number,
  column: number;
  row: number;
}

type GridItem = Element | null;

const elements: Element[] = [
  { atomicNumber: 1, group: 8, name: 'Hydrogen', symbol: 'H', column: 1, row: 1 },
  { atomicNumber: 2, group: 9, name: 'Helium', symbol: 'He', column: 18, row: 1 },
  { atomicNumber: 3, group: 1, name: 'Lithium', symbol: 'Li', column: 1, row: 2 },
  { atomicNumber: 4, group: 2, name: 'Beryllium', symbol: 'Be', column: 2, row: 2 },
  { atomicNumber: 5, group: 7, name: 'Boron', symbol: 'B', column: 13, row: 2 },
  { atomicNumber: 6, group: 8, name: 'Carbon', symbol: 'C', column: 14, row: 2 },
  { atomicNumber: 7, group: 8, name: 'Nitrogen', symbol: 'N', column: 15, row: 2 },
  { atomicNumber: 8, group: 8, name: 'Oxygen', symbol: 'O', column: 16, row: 2 },
  { atomicNumber: 9, group: 8, name: 'Fluorine', symbol: 'F', column: 17, row: 2 },
  { atomicNumber: 10, group: 9, name: 'Neon', symbol: 'Ne', column: 18, row: 2 },
  { atomicNumber: 11, group: 1, name: 'Sodium', symbol: 'Na', column: 1, row: 3 },
  { atomicNumber: 12, group: 2, name: 'Magnesium', symbol: 'Mg', column: 2, row: 3 },
  { atomicNumber: 13, group: 6, name: 'Aluminum', symbol: 'Al', column: 13, row: 3 },
  { atomicNumber: 14, group: 7, name: 'Silicon', symbol: 'Si', column: 14, row: 3 },
  { atomicNumber: 15, group: 8, name: 'Phosphorus', symbol: 'P', column: 15, row: 3 },
  { atomicNumber: 16, group: 8, name: 'Sulfur', symbol: 'S', column: 16, row: 3 },
  { atomicNumber: 17, group: 8, name: 'Chlorine', symbol: 'Cl', column: 17, row: 3 },
  { atomicNumber: 18, group: 9, name: 'Argon', symbol: 'Ar', column: 18, row: 3 },
  { atomicNumber: 19, group: 1, name: 'Potassium', symbol: 'K', column: 1, row: 4 },
  { atomicNumber: 20, group: 2, name: 'Calcium', symbol: 'Ca', column: 2, row: 4 },
  { atomicNumber: 21, group: 5, name: 'Scandium', symbol: 'Sc', column: 3, row: 4 },
  { atomicNumber: 22, group: 5, name: 'Titanium', symbol: 'Ti', column: 4, row: 4 },
  { atomicNumber: 23, group: 5, name: 'Vanadium', symbol: 'V', column: 5, row: 4 },
  { atomicNumber: 24, group: 5, name: 'Chromium', symbol: 'Cr', column: 6, row: 4 },
  { atomicNumber: 25, group: 5, name: 'Manganese', symbol: 'Mn', column: 7, row: 4 },
  { atomicNumber: 26, group: 5, name: 'Iron', symbol: 'Fe', column: 8, row: 4 },
  { atomicNumber: 27, group: 5, name: 'Cobalt', symbol: 'Co', column: 9, row: 4 },
  { atomicNumber: 28, group: 5, name: 'Nickel', symbol: 'Ni', column: 10, row: 4 },
  { atomicNumber: 29, group: 5, name: 'Copper', symbol: 'Cu', column: 11, row: 4 },
  { atomicNumber: 30, group: 5, name: 'Zinc', symbol: 'Zn', column: 12, row: 4 },
  { atomicNumber: 31, group: 6, name: 'Gallium', symbol: 'Ga', column: 13, row: 4 },
  { atomicNumber: 32, group: 7, name: 'Germanium', symbol: 'Ge', column: 14, row: 4 },
  { atomicNumber: 33, group: 7, name: 'Arsenic', symbol: 'As', column: 15, row: 4 },
  { atomicNumber: 34, group: 8, name: 'Selenium', symbol: 'Se', column: 16, row: 4 },
  { atomicNumber: 35, group: 8, name: 'Bromine', symbol: 'Br', column: 17, row: 4 },
  { atomicNumber: 36, group: 9, name: 'Krypton', symbol: 'Kr', column: 18, row: 4 },
  { atomicNumber: 37, group: 1, name: 'Rubidium', symbol: 'Rb', column: 1, row: 5 },
  { atomicNumber: 38, group: 2, name: 'Strontium', symbol: 'Sr', column: 2, row: 5 },
  { atomicNumber: 39, group: 5, name: 'Yttrium', symbol: 'Y', column: 3, row: 5 },
  { atomicNumber: 40, group: 5, name: 'Zirconium', symbol: 'Zr', column: 4, row: 5 },
  { atomicNumber: 41, group: 5, name: 'Niobium', symbol: 'Nb', column: 5, row: 5 },
  { atomicNumber: 42, group: 5, name: 'Molybdenum', symbol: 'Mo', column: 6, row: 5 },
  { atomicNumber: 43, group: 5, name: 'Technetium', symbol: 'Tc', column: 7, row: 5 },
  { atomicNumber: 44, group: 5, name: 'Ruthenium', symbol: 'Ru', column: 8, row: 5 },
  { atomicNumber: 45, group: 5, name: 'Rhodium', symbol: 'Rh', column: 9, row: 5 },
  { atomicNumber: 46, group: 5, name: 'Palladium', symbol: 'Pd', column: 10, row: 5 },
  { atomicNumber: 47, group: 5, name: 'Silver', symbol: 'Ag', column: 11, row: 5 },
  { atomicNumber: 48, group: 5, name: 'Cadmium', symbol: 'Cd', column: 12, row: 5 },
  { atomicNumber: 49, group: 6, name: 'Indium', symbol: 'In', column: 13, row: 5 },
  { atomicNumber: 50, group: 6, name: 'Tin', symbol: 'Sn', column: 14, row: 5 },
  { atomicNumber: 51, group: 7, name: 'Antimony', symbol: 'Sb', column: 15, row: 5 },
  { atomicNumber: 52, group: 7, name: 'Tellurium', symbol: 'Te', column: 16, row: 5 },
  { atomicNumber: 53, group: 8, name: 'Iodine', symbol: 'I', column: 17, row: 5 },
  { atomicNumber: 54, group: 9, name: 'Xenon', symbol: 'Xe', column: 18, row: 5 },
  { atomicNumber: 55, group: 1, name: 'Cesium', symbol: 'Cs', column: 1, row: 6 },
  { atomicNumber: 56, group: 2, name: 'Barium', symbol: 'Ba', column: 2, row: 6 },
  //{ atomicNumber: 71, group: 5, name: 'Lanthadines', symbol: '-', column: 3, row: 6 },
  { atomicNumber: 72, group: 5, name: 'Hafnium', symbol: 'Hf', column: 4, row: 6 },
  { atomicNumber: 73, group: 5, name: 'Tantalum', symbol: 'Ta', column: 5, row: 6 },
  { atomicNumber: 74, group: 5, name: 'Tungsten', symbol: 'W', column: 6, row: 6 },
  { atomicNumber: 75, group: 5, name: 'Rhenium', symbol: 'Re', column: 7, row: 6 },
  { atomicNumber: 76, group: 5, name: 'Osmium', symbol: 'Os', column: 8, row: 6 },
  { atomicNumber: 77, group: 5, name: 'Iridium', symbol: 'Ir', column: 9, row: 6 },
  { atomicNumber: 78, group: 5, name: 'Platinum', symbol: 'Pt', column: 10, row: 6 },
  { atomicNumber: 79, group: 5, name: 'Gold', symbol: 'Au', column: 11, row: 6 },
  { atomicNumber: 80, group: 5, name: 'Mercury', symbol: 'Hg', column: 12, row: 6 },
  { atomicNumber: 81, group: 6, name: 'Thallium', symbol: 'Tl', column: 13, row: 6 },
  { atomicNumber: 82, group: 6, name: 'Lead', symbol: 'Pb', column: 14, row: 6 },
  { atomicNumber: 83, group: 6, name: 'Bismuth', symbol: 'Bi', column: 15, row: 6 },
  { atomicNumber: 84, group: 6, name: 'Polonium', symbol: 'Po', column: 16, row: 6 },
  { atomicNumber: 85, group: 8, name: 'Astatine', symbol: 'At', column: 17, row: 6 },
  { atomicNumber: 86, group: 9, name: 'Radon', symbol: 'Rn', column: 18, row: 6 },
  { atomicNumber: 87, group: 1, name: 'Francium', symbol: 'Fr', column: 1, row: 7 },
  { atomicNumber: 88, group: 2, name: 'Radium', symbol: 'Ra', column: 2, row: 7 },
  //{ atomicNumber: 103, group: 5, name: 'Actanides', symbol: '-', column: 3, row: 7 },
  { atomicNumber: 104, group: 5, name: 'Rutherfordium', symbol: 'Rf', column: 4, row: 7 },
  { atomicNumber: 105, group: 5, name: 'Dubnium', symbol: 'Db', column: 5, row: 7 },
  { atomicNumber: 106, group: 5, name: 'Seaborgium', symbol: 'Sg', column: 6, row: 7 },
  { atomicNumber: 107, group: 5, name: 'Bohrium', symbol: 'Bh', column: 7, row: 7 },
  { atomicNumber: 108, group: 5, name: 'Hassium', symbol: 'Hs', column: 8, row: 7 },
  { atomicNumber: 109, group: 5, name: 'Meitnerium', symbol: 'Mt', column: 9, row: 7 },
  { atomicNumber: 110, group: 5, name: 'Darmstadtium', symbol: 'Ds', column: 10, row: 7 },
  { atomicNumber: 111, group: 5, name: 'Roentgenium', symbol: 'Rg', column: 11, row: 7 },
  { atomicNumber: 112, group: 5, name: 'Copernicium', symbol: 'Cn', column: 12, row: 7 },
  { atomicNumber: 113, group: 6, name: 'Nihonium', symbol: 'Nh', column: 13, row: 7 },
  { atomicNumber: 114, group: 6, name: 'Flerovium', symbol: 'Fl', column: 14, row: 7 },
  { atomicNumber: 115, group: 6, name: 'Moscovium', symbol: 'Mc', column: 15, row: 7 },
  { atomicNumber: 116, group: 6, name: 'Livermorium', symbol: 'Lv', column: 16, row: 7 },
  { atomicNumber: 117, group: 8, name: 'Tennessine', symbol: 'Ts', column: 17, row: 7 },
  { atomicNumber: 118, group: 9, name: 'Oganesson', symbol: 'Og', column: 18, row: 7 },
];

const lanthanides: Element[] = [
  { atomicNumber: 57, group: 3, name: 'Lanthanum', symbol: 'La', column: 3, row: 9 },
  { atomicNumber: 58, group: 3, name: 'Cerium', symbol: 'Ce', column: 4, row: 9 },
  { atomicNumber: 59, group: 3, name: 'Praseodymium', symbol: 'Pr', column: 5, row: 9 },
  { atomicNumber: 60, group: 3, name: 'Neodymium', symbol: 'Nd', column: 6, row: 9 },
  { atomicNumber: 61, group: 3, name: 'Promethium', symbol: 'Pm', column: 7, row: 9 },
  { atomicNumber: 62, group: 3, name: 'Samarium', symbol: 'Sm', column: 8, row: 9 },
  { atomicNumber: 63, group: 3, name: 'Europium', symbol: 'Eu', column: 9, row: 9 },
  { atomicNumber: 64, group: 3, name: 'Gadolinium', symbol: 'Gd', column: 10, row: 9 },
  { atomicNumber: 65, group: 3, name: 'Terbium', symbol: 'Tb', column: 11, row: 9 },
  { atomicNumber: 66, group: 3, name: 'Dysprosium', symbol: 'Dy', column: 12, row: 9 },
  { atomicNumber: 67, group: 3, name: 'Holmium', symbol: 'Ho', column: 13, row: 9 },
  { atomicNumber: 68, group: 3, name: 'Erbium', symbol: 'Er', column: 14, row: 9 },
  { atomicNumber: 69, group: 3, name: 'Thulium', symbol: 'Tm', column: 15, row: 9 },
  { atomicNumber: 70, group: 3, name: 'Ytterbium', symbol: 'Yb', column: 16, row: 9 },
  { atomicNumber: 71, group: 3, name: 'Lutetium', symbol: 'Lu', column: 17, row: 9 },
];

const actinides: Element[] = [
  { atomicNumber: 89, group: 4, name: 'Actinium', symbol: 'Ac', column: 3, row: 10 },
  { atomicNumber: 90, group: 4, name: 'Thorium', symbol: 'Th', column: 4, row: 10 },
  { atomicNumber: 91, group: 4, name: 'Protactinium', symbol: 'Pa', column: 5, row: 10 },
  { atomicNumber: 92, group: 4, name: 'Uranium', symbol: 'U', column: 6, row: 10 },
  { atomicNumber: 93, group: 4, name: 'Neptunium', symbol: 'Np', column: 7, row: 10 },
  { atomicNumber: 94, group: 4, name: 'Plutonium', symbol: 'Pu', column: 8, row: 10 },
  { atomicNumber: 95, group: 4, name: 'Americium', symbol: 'Am', column: 9, row: 10 },
  { atomicNumber: 96, group: 4, name: 'Curium', symbol: 'Cm', column: 10, row: 10 },
  { atomicNumber: 97, group: 4, name: 'Berkelium', symbol: 'Bk', column: 11, row: 10 },
  { atomicNumber: 98, group: 4, name: 'Californium', symbol: 'Cf', column: 12, row: 10 },
  { atomicNumber: 99, group: 4, name: 'Einsteinium', symbol: 'Es', column: 13, row: 10 },
  { atomicNumber: 100, group: 4, name: 'Fermium', symbol: 'Fm', column: 14, row: 10 },
  { atomicNumber: 101, group: 4, name: 'Mendelevium', symbol: 'Md', column: 15, row: 10 },
  { atomicNumber: 102, group: 4, name: 'Nobelium', symbol: 'No', column: 16, row: 10 },
  { atomicNumber: 103, group: 4, name: 'Lawrencium', symbol: 'Lr', column: 17, row: 10 },
];

const PeriodicTable: React.FC = () => {
  const allElements = [...elements, ...lanthanides, ...actinides];

  const grid: GridItem[][] = Array(10).fill(null).map(() => Array(18).fill(null));

  allElements.forEach(element => {
    grid[element.row - 1][element.column - 1] = element;
  });

  const flatGrid = grid.flat();

  const ref = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const list = useListState({
    selectionMode: 'single',
    onSelectionChange: (selection) => {
      if (selection === 'all') {
        setSelectedIndex(null);
      } else {
        setSelectedIndex(selection.size > 0 ? Array.from(selection)[0] as number : null);
      }
    }
  })

  const { gridProps } = useGridList({
    'aria-label': 'Periodic Table of Elements',
  }, list, ref);

  return (
    <div className='periodic-table'>
      <div className='periodic-table__state-info'>
        <span className='periodic-table__state-info__item periodic-table__state-info__item--selectable'>
          <span className='periodic-table__state-info__item-rectangle'></span>
          Selectable
        </span>
        <span className='periodic-table__state-info__item periodic-table__state-info__item--chosen'>
          <span className='periodic-table__state-info__item-rectangle'></span>
          Chosen
        </span>
        <span className='periodic-table__state-info__item periodic-table__state-info__item--unavailable'>
          <span className='periodic-table__state-info__item-rectangle'></span>
          Unavailable
        </span>
      </div>

      <div {...gridProps} ref={ref} className='periodic-table__grid'>
        {flatGrid.map((element, index) => (
          <div 
            key={index}
            role="gridcell"
            tabIndex={0}
            aria-selected={selectedIndex === index}
            onClick={() => list.selectionManager.select(index)}
            className='periodic-table__grid__cell'
          >
            {element ? (
              <div className={`periodic-table__grid__cell__element ${selectedIndex === index ? 'selected' : ''}`}>
                <div className='periodic-table__grid__cell__element__top'>
                  <div className='periodic-table__grid__cell__element__top__atomic-number'>
                    {element.atomicNumber}
                  </div>
                </div>
                <div className='periodic-table__grid__cell__element__symbol'>
                  {element.symbol}
                </div>
                <div className='periodic-table__grid__cell__element__bottom'>
                  <div className='periodic-table__grid__cell__element__bottom__name'>
                    {element.name}
                  </div>
                </div>
              </div>
            ) : (
              <div className='periodic-table__grid__cell__empty-cell'></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeriodicTable;