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

const elements: Element[] = [
  { group: 1, name: 'Hydrogen', symbol: 'H', atomicNumber: 1, column: 1, row: 1 },
  { group: 2, name: 'Helium', symbol: 'He', atomicNumber: 2, column: 18, row: 1 },
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
      <h2>Periodic Table of Elements</h2>
      <Table aria-label="Periodic Table of Elements" className='periodic-table__table'>
        <TableHeader>
          <Row>
            <Column isRowHeader></Column>
            {columns.map((column) => (
              <Column key={column}>{column + 1}</Column>
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
                        <div className='periodic-table__table__cell__element__atomic-number'>{element.atomicNumber}</div>
                        <div className='periodic-table__table__cell__element__symbol'>{element.symbol}</div>
                        <div className='periodic-table__table__cell__element__name'>{element.name}</div>
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

/*
const PeriodicTable: React.FC = () => {
  return (
    <div className='periodic-table'>
      <h2>Periodic Table of Elements</h2>
      <GridList aria-label='Periodic Table' className='periodic-table__grid'>
        {elements.map((element) => (
          <GridListItem 
            textValue={element.name} 
            key={element.atomicNumber}
            className='periodic-table__grid__element'
            data-column={element.column}
            data-row={element.row}
            >
              <div className='periodic-table__grid__element__atomic-number'>{element.atomicNumber}</div>
              <div className='periodic-table__grid__element__symbol'>{element.symbol}</div>
              <div className='periodic-table__grid__element__name'>{element.name}</div>
          </GridListItem>
        ))}
      </GridList>
    </div>
  )
};

export default PeriodicTable;
*/