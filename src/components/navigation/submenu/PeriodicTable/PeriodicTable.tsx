import React from 'react';
import './PeriodicTable.scss';
import { Table, TableHeader, Column, TableBody, Row, Cell } from 'react-aria-components';

interface Element {
  group: number;
  name: string;
  symbol: string;
  atomicNumber: number,
  column: number;
  row: number;
}

/* Chemical Group Block:

=== Metal ===
- Alkali metals --> Group 1
- Alkaline earth metal --> Group 2
- Lanthanoids --> Group 3
- Actinoids --> Group 4
- Transition metals --> Group 5
- Post-transition metals --> Group 6

(in-between)
- Metalloids --> Group 7

=== Nonmetals ===
- Reactive nonmetals --> Group 8
- Noble gases --> Group 9


*/

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
  { atomicNumber: 71, group: 5, name: 'Lanthadines', symbol: '-', column: 3, row: 6 },
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
  { atomicNumber: 103, group: 5, name: 'Actanides', symbol: '-', column: 3, row: 7 },
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

const PeriodicTable: React.FC = () => {
  const rowCount = 7;
  const columnCount = 18;

  const rows = Array.from({ length: rowCount }, (_, i) => i + 1);
  const columns = Array.from({ length: columnCount }, (_, i) => i);

  const getElement = (row: number, column: number) => {
    return elements.find((element) => element.row === row && element.column === column);
  };

  return (
    <div className='periodic-table'>
      <Table aria-label="Periodic Table of Elements" className='periodic-table__table'>
        <TableHeader>
          <Row>
            <Column isRowHeader></Column>
            {columns.map((column) => (
              <Column className='periodic-table__column' key={column}>{column + 1}</Column>
            ))}
          </Row>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <Row key={row}>
              <Cell className='periodic-table__table__first-column-cell'>{row}</Cell>
              {columns.map((column) => {
                const element = getElement(row, column + 1);
                return (
                  <Cell key={`${row}-${column}`} textValue={element ? element.name : ''} className='periodic-table__table__cell'>
                    {element ? (
                      <div className='periodic-table__table__cell__element'>
                        <div className='periodic-table__table__cell__element__top'>
                          <div className='periodic-table__table__cell__element__top__atomic-number'>{element.atomicNumber}</div>
                        </div>
                        <div className='periodic-table__table__cell__element__symbol'>{element.symbol}</div>
                        <div className='periodic-table__table__cell__element__bottom'>
                          <div className='periodic-table__table__cell__element__bottom__name'>{element.name}</div>
                        </div>
                      </div>
                  //) : null }
                    ) : (
                      <div className='periodic-table__cell__empty-cell'></div>
                    )}
                  </Cell>
                );
              })}
            </Row>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PeriodicTable;