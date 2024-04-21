import React from 'react';
import './PeriodicTable.scss';

interface PeriodicTableProps {}

const PeriodicTable: React.FC<PeriodicTableProps> = () => {
  return (
    <div className="periodic-table">
    <h2>Periodic Table of Elements</h2>
    <table>
      <thead>
        <tr>
          <th>Group</th>
          <th>Name</th>
          <th>Symbol</th>
          <th>Atomic Number</th>
        </tr>
      </thead>
      <tbody>
        {/* rows for each element */}
        <tr>
          <td>1</td>
          <td>Hydrogen</td>
          <td>H</td>
          <td>1</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Helium</td>
          <td>He</td>
          <td>2</td>
        </tr>
        {/* rows for other elements */}
      </tbody>
    </table>
  </div>
  );
};

export default PeriodicTable;