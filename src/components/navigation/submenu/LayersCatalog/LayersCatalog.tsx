import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, TableHeader, TableBody, Column, Row, Cell,
  SearchField, Input,
  ToggleButtonGroup, ToggleButton,
  Selection
} from 'react-aria-components';
import { useFilter } from 'react-aria';
import { layersConfig } from 'geoConfigExporter';
import { stacService, getStacSourceLabel, getStacResolutionLabel, StacItem, STAC_BASE_PATH } from 'services/StacService';
import styles from './LayersCatalog.module.scss';

interface CatalogRow {
  id: string;
  title: string;
  category: string;
  available: boolean;
  stac?: string;
  variantCount: number;
}

const catalogRows: CatalogRow[] = Object.entries(layersConfig.layers)
  .map(([id, config]) => ({
    id,
    title: config.displayName || id,
    category: config.category,
    available: config.available !== false,
    stac: config.stac,
    variantCount: config.variants?.length ?? 0
  }));

const categories: string[] = Array.from(new Set(catalogRows.map((row) => row.category))).sort();

const formatCategoryLabel = (category: string): string =>
  category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const LayersCatalog: React.FC = () => {
  const [stacItems, setStacItems] = useState<Map<string, StacItem | null>>(new Map());
  const [searchText, setSearchText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Selection>(new Set(categories));
  const { contains } = useFilter({ sensitivity: 'base' });

  const filteredRows = useMemo(() => {
    return catalogRows.filter((row) => {
      const matchesCategory = selectedCategories === 'all' || selectedCategories.has(row.category);
      const matchesSearch = searchText === '' || contains(row.title, searchText);
      return matchesCategory && matchesSearch;
    });
  }, [searchText, selectedCategories, contains]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      catalogRows
        .filter((row): row is CatalogRow & { stac: string } => !!row.stac)
        .map((row) =>
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
      <div className={styles.filterBar}>
        <SearchField
          aria-label="Search layers by title"
          value={searchText}
          onChange={setSearchText}
          className={styles.searchField}
        >
          <Input placeholder="Search layers..." />
        </SearchField>
        <ToggleButtonGroup
          aria-label="Filter by category"
          selectionMode="multiple"
          selectedKeys={selectedCategories}
          onSelectionChange={setSelectedCategories}
          className={styles.categoryFilter}
        >
          {categories.map((category) => (
            <ToggleButton key={category} id={category} data-category={category} className={styles.categoryChip}>
              {formatCategoryLabel(category)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <Table aria-label="Layers Catalog" selectionMode="none" className={styles.table}>
        <TableHeader>
          <Column isRowHeader className={styles.headerCell}>Title</Column>
          <Column className={styles.headerCell}>Category</Column>
          <Column className={styles.headerCell}>Source</Column>
          <Column className={styles.headerCell}>Resolution</Column>
          <Column className={styles.headerCell}>Available</Column>
          <Column className={styles.headerCell}>STAC</Column>
        </TableHeader>
        <TableBody items={filteredRows} dependencies={[stacItems]} renderEmptyState={() => (
          <span className={styles.emptyState}>No layers match the current filters.</span>
        )}>
          {(row) => {
            const stacItem = row.stac ? stacItems.get(row.stac) : undefined;
            const source = stacItem ? getStacSourceLabel(stacItem.properties) : undefined;
            const resolution = stacItem ? getStacResolutionLabel(stacItem.properties) : undefined;

            return (
              <Row id={row.id} textValue={row.title} className={styles.row}>
                <Cell className={styles.cell}>{row.title}</Cell>
                <Cell className={styles.cell}>
                  <span className={styles.categoryTag} data-category={row.category}>
                    {formatCategoryLabel(row.category)}
                  </span>
                </Cell>
                <Cell className={styles.cell}>{source || '-'}</Cell>
                <Cell className={styles.cell}>{resolution || '-'}</Cell>
                <Cell className={styles.cell}>
                  <span className={`material-symbols-outlined ${row.available ? styles.available : styles.unavailable}`}>
                    {row.available ? 'check_circle' : 'cancel'}
                  </span>
                </Cell>
                <Cell className={styles.cell}>
                  {row.stac ? (
                    <>
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
                    </>
                  ) : (
                    '-'
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
