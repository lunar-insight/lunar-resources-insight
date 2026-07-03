import React, { useEffect, useState } from 'react';
import { Table, TableHeader, TableBody, Column, Row, Cell } from 'react-aria-components';
import { layersConfig } from 'geoConfigExporter';
import { stacService, getStacSourceLabel, getStacResolutionLabel, StacItem, STAC_BASE_PATH } from 'services/StacService';
import styles from './LayersCatalog.module.scss';

interface CatalogRow {
  id: string;
  title: string;
  category: string;
  available: boolean;
  stac: string;
  variantCount: number;
}

const catalogRows: CatalogRow[] = Object.entries(layersConfig.layers)
  .filter(([, config]) => !!config.stac)
  .map(([id, config]) => ({
    id,
    title: config.displayName || id,
    category: config.category,
    available: config.available !== false,
    stac: config.stac as string,
    variantCount: config.variants?.length ?? 0
  }));

const LayersCatalog: React.FC = () => {
  const [stacItems, setStacItems] = useState<Map<string, StacItem | null>>(new Map());

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      catalogRows.map((row) =>
        stacService.fetchStacItem(row.stac).then((item) => [row.stac, item] as const)
      )
    ).then((entries) => {
      if (!cancelled) {
        setStacItems(new Map(entries));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.layersCatalog}>
      <Table aria-label="Layers Catalog" selectionMode="none" className={styles.table}>
        <TableHeader>
          <Column isRowHeader className={styles.headerCell}>Title</Column>
          <Column className={styles.headerCell}>Category</Column>
          <Column className={styles.headerCell}>Source</Column>
          <Column className={styles.headerCell}>Resolution</Column>
          <Column className={styles.headerCell}>Available</Column>
          <Column className={styles.headerCell}>STAC</Column>
        </TableHeader>
        <TableBody items={catalogRows} dependencies={[stacItems]}>
          {(row) => {
            const stacItem = stacItems.get(row.stac);
            const source = stacItem ? getStacSourceLabel(stacItem.properties) : undefined;
            const resolution = stacItem ? getStacResolutionLabel(stacItem.properties) : undefined;

            return (
              <Row id={row.id} textValue={row.title} className={styles.row}>
                <Cell className={styles.cell}>{row.title}</Cell>
                <Cell className={`${styles.cell} ${styles.category}`}>{row.category}</Cell>
                <Cell className={styles.cell}>{source || '–'}</Cell>
                <Cell className={styles.cell}>{resolution || '–'}</Cell>
                <Cell className={styles.cell}>
                  <span className={`material-symbols-outlined ${row.available ? styles.available : styles.unavailable}`}>
                    {row.available ? 'check_circle' : 'cancel'}
                  </span>
                </Cell>
                <Cell className={styles.cell}>
                  <a
                    href={`${STAC_BASE_PATH}/${row.stac}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.stacLink}
                  >
                    View
                  </a>
                  {row.variantCount > 0 && (
                    <span className={styles.variantBadge}>+{row.variantCount} more</span>
                  )}
                </Cell>
              </Row>
            );
          }}
        </TableBody>
      </Table>
    </div>
  );
};

export default LayersCatalog;
