import React from 'react';
import { ListBox, ListBoxItem, Text } from 'react-aria-components';
import './PeriodicTable.scss';

export interface Element {
  group: number;
  name: string;
  symbol: string;
  atomicNumber: number,
  column: number;
  row: number;
  dataExist: boolean;
}

const elements: Element[] = [
  { atomicNumber: 1, group: 8, name: 'Hydrogen', symbol: 'H', column: 1, row: 1, dataExist: false },
  { atomicNumber: 2, group: 9, name: 'Helium', symbol: 'He', column: 18, row: 1, dataExist: false },
  { atomicNumber: 3, group: 1, name: 'Lithium', symbol: 'Li', column: 1, row: 2, dataExist: false },
  { atomicNumber: 4, group: 2, name: 'Beryllium', symbol: 'Be', column: 2, row: 2, dataExist: false },
  { atomicNumber: 5, group: 7, name: 'Boron', symbol: 'B', column: 13, row: 2, dataExist: false },
  { atomicNumber: 6, group: 8, name: 'Carbon', symbol: 'C', column: 14, row: 2, dataExist: false },
  { atomicNumber: 7, group: 8, name: 'Nitrogen', symbol: 'N', column: 15, row: 2, dataExist: false },
  { atomicNumber: 8, group: 8, name: 'Oxygen', symbol: 'O', column: 16, row: 2, dataExist: false },
  { atomicNumber: 9, group: 8, name: 'Fluorine', symbol: 'F', column: 17, row: 2, dataExist: false },
  { atomicNumber: 10, group: 9, name: 'Neon', symbol: 'Ne', column: 18, row: 2, dataExist: false },
  { atomicNumber: 11, group: 1, name: 'Sodium', symbol: 'Na', column: 1, row: 3, dataExist: false },
  { atomicNumber: 12, group: 2, name: 'Magnesium', symbol: 'Mg', column: 2, row: 3, dataExist: true },
  { atomicNumber: 13, group: 6, name: 'Aluminum', symbol: 'Al', column: 13, row: 3, dataExist: false },
  { atomicNumber: 14, group: 7, name: 'Silicon', symbol: 'Si', column: 14, row: 3, dataExist: false },
  { atomicNumber: 15, group: 8, name: 'Phosphorus', symbol: 'P', column: 15, row: 3, dataExist: false },
  { atomicNumber: 16, group: 8, name: 'Sulfur', symbol: 'S', column: 16, row: 3, dataExist: false },
  { atomicNumber: 17, group: 8, name: 'Chlorine', symbol: 'Cl', column: 17, row: 3, dataExist: false },
  { atomicNumber: 18, group: 9, name: 'Argon', symbol: 'Ar', column: 18, row: 3, dataExist: false },
  { atomicNumber: 19, group: 1, name: 'Potassium', symbol: 'K', column: 1, row: 4, dataExist: false },
  { atomicNumber: 20, group: 2, name: 'Calcium', symbol: 'Ca', column: 2, row: 4, dataExist: true },
  { atomicNumber: 21, group: 5, name: 'Scandium', symbol: 'Sc', column: 3, row: 4, dataExist: false },
  { atomicNumber: 22, group: 5, name: 'Titanium', symbol: 'Ti', column: 4, row: 4, dataExist: true },
  { atomicNumber: 23, group: 5, name: 'Vanadium', symbol: 'V', column: 5, row: 4, dataExist: false },
  { atomicNumber: 24, group: 5, name: 'Chromium', symbol: 'Cr', column: 6, row: 4, dataExist: false },
  { atomicNumber: 25, group: 5, name: 'Manganese', symbol: 'Mn', column: 7, row: 4, dataExist: false },
  { atomicNumber: 26, group: 5, name: 'Iron', symbol: 'Fe', column: 8, row: 4, dataExist: true },
  { atomicNumber: 27, group: 5, name: 'Cobalt', symbol: 'Co', column: 9, row: 4, dataExist: false },
  { atomicNumber: 28, group: 5, name: 'Nickel', symbol: 'Ni', column: 10, row: 4, dataExist: false },
  { atomicNumber: 29, group: 5, name: 'Copper', symbol: 'Cu', column: 11, row: 4, dataExist: false },
  { atomicNumber: 30, group: 5, name: 'Zinc', symbol: 'Zn', column: 12, row: 4, dataExist: false },
  { atomicNumber: 31, group: 6, name: 'Gallium', symbol: 'Ga', column: 13, row: 4, dataExist: false },
  { atomicNumber: 32, group: 7, name: 'Germanium', symbol: 'Ge', column: 14, row: 4, dataExist: false },
  { atomicNumber: 33, group: 7, name: 'Arsenic', symbol: 'As', column: 15, row: 4, dataExist: false },
  { atomicNumber: 34, group: 8, name: 'Selenium', symbol: 'Se', column: 16, row: 4, dataExist: false },
  { atomicNumber: 35, group: 8, name: 'Bromine', symbol: 'Br', column: 17, row: 4, dataExist: false },
  { atomicNumber: 36, group: 9, name: 'Krypton', symbol: 'Kr', column: 18, row: 4, dataExist: false },
  { atomicNumber: 37, group: 1, name: 'Rubidium', symbol: 'Rb', column: 1, row: 5, dataExist: false },
  { atomicNumber: 38, group: 2, name: 'Strontium', symbol: 'Sr', column: 2, row: 5, dataExist: false },
  { atomicNumber: 39, group: 5, name: 'Yttrium', symbol: 'Y', column: 3, row: 5, dataExist: false },
  { atomicNumber: 40, group: 5, name: 'Zirconium', symbol: 'Zr', column: 4, row: 5, dataExist: false },
  { atomicNumber: 41, group: 5, name: 'Niobium', symbol: 'Nb', column: 5, row: 5, dataExist: false },
  { atomicNumber: 42, group: 5, name: 'Molybdenum', symbol: 'Mo', column: 6, row: 5, dataExist: false },
  { atomicNumber: 43, group: 5, name: 'Technetium', symbol: 'Tc', column: 7, row: 5, dataExist: false },
  { atomicNumber: 44, group: 5, name: 'Ruthenium', symbol: 'Ru', column: 8, row: 5, dataExist: false },
  { atomicNumber: 45, group: 5, name: 'Rhodium', symbol: 'Rh', column: 9, row: 5, dataExist: false },
  { atomicNumber: 46, group: 5, name: 'Palladium', symbol: 'Pd', column: 10, row: 5, dataExist: false },
  { atomicNumber: 47, group: 5, name: 'Silver', symbol: 'Ag', column: 11, row: 5, dataExist: false },
  { atomicNumber: 48, group: 5, name: 'Cadmium', symbol: 'Cd', column: 12, row: 5, dataExist: false },
  { atomicNumber: 49, group: 6, name: 'Indium', symbol: 'In', column: 13, row: 5, dataExist: false },
  { atomicNumber: 50, group: 6, name: 'Tin', symbol: 'Sn', column: 14, row: 5, dataExist: false },
  { atomicNumber: 51, group: 7, name: 'Antimony', symbol: 'Sb', column: 15, row: 5, dataExist: false },
  { atomicNumber: 52, group: 7, name: 'Tellurium', symbol: 'Te', column: 16, row: 5, dataExist: false },
  { atomicNumber: 53, group: 8, name: 'Iodine', symbol: 'I', column: 17, row: 5, dataExist: false },
  { atomicNumber: 54, group: 9, name: 'Xenon', symbol: 'Xe', column: 18, row: 5, dataExist: false },
  { atomicNumber: 55, group: 1, name: 'Cesium', symbol: 'Cs', column: 1, row: 6, dataExist: false },
  { atomicNumber: 56, group: 2, name: 'Barium', symbol: 'Ba', column: 2, row: 6, dataExist: false },
  { atomicNumber: 72, group: 5, name: 'Hafnium', symbol: 'Hf', column: 4, row: 6, dataExist: false },
  { atomicNumber: 73, group: 5, name: 'Tantalum', symbol: 'Ta', column: 5, row: 6, dataExist: false },
  { atomicNumber: 74, group: 5, name: 'Tungsten', symbol: 'W', column: 6, row: 6, dataExist: false },
  { atomicNumber: 75, group: 5, name: 'Rhenium', symbol: 'Re', column: 7, row: 6, dataExist: false },
  { atomicNumber: 76, group: 5, name: 'Osmium', symbol: 'Os', column: 8, row: 6, dataExist: false },
  { atomicNumber: 77, group: 5, name: 'Iridium', symbol: 'Ir', column: 9, row: 6, dataExist: false },
  { atomicNumber: 78, group: 5, name: 'Platinum', symbol: 'Pt', column: 10, row: 6, dataExist: false },
  { atomicNumber: 79, group: 5, name: 'Gold', symbol: 'Au', column: 11, row: 6, dataExist: false },
  { atomicNumber: 80, group: 5, name: 'Mercury', symbol: 'Hg', column: 12, row: 6, dataExist: false },
  { atomicNumber: 81, group: 6, name: 'Thallium', symbol: 'Tl', column: 13, row: 6, dataExist: false },
  { atomicNumber: 82, group: 6, name: 'Lead', symbol: 'Pb', column: 14, row: 6, dataExist: false },
  { atomicNumber: 83, group: 6, name: 'Bismuth', symbol: 'Bi', column: 15, row: 6, dataExist: false },
  { atomicNumber: 84, group: 6, name: 'Polonium', symbol: 'Po', column: 16, row: 6, dataExist: false },
  { atomicNumber: 85, group: 8, name: 'Astatine', symbol: 'At', column: 17, row: 6, dataExist: false },
  { atomicNumber: 86, group: 9, name: 'Radon', symbol: 'Rn', column: 18, row: 6, dataExist: false },
  { atomicNumber: 87, group: 1, name: 'Francium', symbol: 'Fr', column: 1, row: 7, dataExist: false },
  { atomicNumber: 88, group: 2, name: 'Radium', symbol: 'Ra', column: 2, row: 7, dataExist: false },
  { atomicNumber: 104, group: 5, name: 'Rutherfordium', symbol: 'Rf', column: 4, row: 7, dataExist: false },
  { atomicNumber: 105, group: 5, name: 'Dubnium', symbol: 'Db', column: 5, row: 7, dataExist: false },
  { atomicNumber: 106, group: 5, name: 'Seaborgium', symbol: 'Sg', column: 6, row: 7, dataExist: false },
  { atomicNumber: 107, group: 5, name: 'Bohrium', symbol: 'Bh', column: 7, row: 7, dataExist: false },
  { atomicNumber: 108, group: 5, name: 'Hassium', symbol: 'Hs', column: 8, row: 7, dataExist: false },
  { atomicNumber: 109, group: 5, name: 'Meitnerium', symbol: 'Mt', column: 9, row: 7, dataExist: false },
  { atomicNumber: 110, group: 5, name: 'Darmstadtium', symbol: 'Ds', column: 10, row: 7, dataExist: false },
  { atomicNumber: 111, group: 5, name: 'Roentgenium', symbol: 'Rg', column: 11, row: 7, dataExist: false },
  { atomicNumber: 112, group: 5, name: 'Copernicium', symbol: 'Cn', column: 12, row: 7, dataExist: false },
  { atomicNumber: 113, group: 6, name: 'Nihonium', symbol: 'Nh', column: 13, row: 7, dataExist: false },
  { atomicNumber: 114, group: 6, name: 'Flerovium', symbol: 'Fl', column: 14, row: 7, dataExist: false },
  { atomicNumber: 115, group: 6, name: 'Moscovium', symbol: 'Mc', column: 15, row: 7, dataExist: false },
  { atomicNumber: 116, group: 6, name: 'Livermorium', symbol: 'Lv', column: 16, row: 7, dataExist: false },
  { atomicNumber: 117, group: 8, name: 'Tennessine', symbol: 'Ts', column: 17, row: 7, dataExist: false },
  { atomicNumber: 118, group: 9, name: 'Oganesson', symbol: 'Og', column: 18, row: 7, dataExist: false },
];

const lanthanides: Element[] = [
  { atomicNumber: 57, group: 3, name: 'Lanthanum', symbol: 'La', column: 3, row: 9, dataExist: false },
  { atomicNumber: 58, group: 3, name: 'Cerium', symbol: 'Ce', column: 4, row: 9, dataExist: false },
  { atomicNumber: 59, group: 3, name: 'Praseodymium', symbol: 'Pr', column: 5, row: 9, dataExist: false },
  { atomicNumber: 60, group: 3, name: 'Neodymium', symbol: 'Nd', column: 6, row: 9, dataExist: false },
  { atomicNumber: 61, group: 3, name: 'Promethium', symbol: 'Pm', column: 7, row: 9, dataExist: false },
  { atomicNumber: 62, group: 3, name: 'Samarium', symbol: 'Sm', column: 8, row: 9, dataExist: false },
  { atomicNumber: 63, group: 3, name: 'Europium', symbol: 'Eu', column: 9, row: 9, dataExist: false },
  { atomicNumber: 64, group: 3, name: 'Gadolinium', symbol: 'Gd', column: 10, row: 9, dataExist: false },
  { atomicNumber: 65, group: 3, name: 'Terbium', symbol: 'Tb', column: 11, row: 9, dataExist: false },
  { atomicNumber: 66, group: 3, name: 'Dysprosium', symbol: 'Dy', column: 12, row: 9, dataExist: false },
  { atomicNumber: 67, group: 3, name: 'Holmium', symbol: 'Ho', column: 13, row: 9, dataExist: false },
  { atomicNumber: 68, group: 3, name: 'Erbium', symbol: 'Er', column: 14, row: 9, dataExist: false },
  { atomicNumber: 69, group: 3, name: 'Thulium', symbol: 'Tm', column: 15, row: 9, dataExist: false },
  { atomicNumber: 70, group: 3, name: 'Ytterbium', symbol: 'Yb', column: 16, row: 9, dataExist: false },
  { atomicNumber: 71, group: 3, name: 'Lutetium', symbol: 'Lu', column: 17, row: 9, dataExist: false },
];

const actinides: Element[] = [
  { atomicNumber: 89, group: 4, name: 'Actinium', symbol: 'Ac', column: 3, row: 10, dataExist: false },
  { atomicNumber: 90, group: 4, name: 'Thorium', symbol: 'Th', column: 4, row: 10, dataExist: false },
  { atomicNumber: 91, group: 4, name: 'Protactinium', symbol: 'Pa', column: 5, row: 10, dataExist: false },
  { atomicNumber: 92, group: 4, name: 'Uranium', symbol: 'U', column: 6, row: 10, dataExist: false },
  { atomicNumber: 93, group: 4, name: 'Neptunium', symbol: 'Np', column: 7, row: 10, dataExist: false },
  { atomicNumber: 94, group: 4, name: 'Plutonium', symbol: 'Pu', column: 8, row: 10, dataExist: false },
  { atomicNumber: 95, group: 4, name: 'Americium', symbol: 'Am', column: 9, row: 10, dataExist: false },
  { atomicNumber: 96, group: 4, name: 'Curium', symbol: 'Cm', column: 10, row: 10, dataExist: false },
  { atomicNumber: 97, group: 4, name: 'Berkelium', symbol: 'Bk', column: 11, row: 10, dataExist: false },
  { atomicNumber: 98, group: 4, name: 'Californium', symbol: 'Cf', column: 12, row: 10, dataExist: false },
  { atomicNumber: 99, group: 4, name: 'Einsteinium', symbol: 'Es', column: 13, row: 10, dataExist: false },
  { atomicNumber: 100, group: 4, name: 'Fermium', symbol: 'Fm', column: 14, row: 10, dataExist: false },
  { atomicNumber: 101, group: 4, name: 'Mendelevium', symbol: 'Md', column: 15, row: 10, dataExist: false },
  { atomicNumber: 102, group: 4, name: 'Nobelium', symbol: 'No', column: 16, row: 10, dataExist: false },
  { atomicNumber: 103, group: 4, name: 'Lawrencium', symbol: 'Lr', column: 17, row: 10, dataExist: false },
];

export interface PeriodicTableProps {
  onElementSelect: (element: Element) => void;
  selectedElements: Element[];
}

const ALL_ELEMENTS = [...elements, ...lanthanides, ...actinides];

const GRID: (Element | null)[][] = Array(10).fill(null).map(() => Array(18).fill(null));

ALL_ELEMENTS.forEach(element => {
  GRID[element.row - 1][element.column - 1] = element;
});

const DISABLED_KEYS = new Set<string>();
GRID.forEach((row, rowIndex) => {
  row.forEach((element, colIndex) => {
    if (element === null || (element && !element.dataExist)) {
      DISABLED_KEYS.add(`${rowIndex + 1}-${colIndex + 1}`);
    }
  });
});

const PeriodicTable: React.FC<PeriodicTableProps> = ({ onElementSelect, selectedElements }) => {
  const selectedKeys = new Set(selectedElements.map(el => `${el.row}-${el.column}`));

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

      <ListBox
        aria-label="Periodic Table of Element"
        layout="grid"
        items={ALL_ELEMENTS}
        selectionMode="multiple"
        className="periodic-table__grid"
        disabledKeys={DISABLED_KEYS}
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          const newKeys = new Set(keys);
          ALL_ELEMENTS.forEach(element => {
            const elementKey = `${element.row}-${element.column}`;
            if (newKeys.has(elementKey) && !selectedKeys.has(elementKey)) {
              onElementSelect(element);
            } else if (!newKeys.has(elementKey) && selectedKeys.has(elementKey)) {
              onElementSelect(element);
            }
          });
        }}
      >
        {GRID.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((item, colIndex) => {
              const cellKey = `${rowIndex + 1}-${colIndex + 1}`;
              return (
                <ListBoxItem
                  key={cellKey}
                  id={cellKey}    
                  textValue={item?.name || 'Empty'}
                  className={`periodic-table__grid__cell ${item && !item.dataExist ? 'periodic-table__grid__cell--unavailable' : ''}`}
                >
                  {item ? (
                    <div className={`periodic-table__grid__cell__element ${!item.dataExist ? 'periodic-table__grid__cell__element--unavailable' : ''}`}>
                      <div className='periodic-table__grid__cell__element__top'>
                        <Text slot='description' className='periodic-table__grid__cell__element__top__atomic-number'>
                          {item.atomicNumber}
                        </Text>
                      </div>
                      <Text slot="label" className='periodic-table__grid__cell__element__symbol'>
                        {item.symbol}
                      </Text>
                      <div className='periodic-table__grid__cell__element__bottom'>
                        <Text slot="description" className='periodic-table__grid__cell__element__bottom__name'>
                          {item.name}
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <div className='periodic-table__grid__cell__empty-cell'></div>
                  )}
                </ListBoxItem>
              );
            })}
          </React.Fragment>
        ))}
      </ListBox>
    </div>
  );
};

export default PeriodicTable;