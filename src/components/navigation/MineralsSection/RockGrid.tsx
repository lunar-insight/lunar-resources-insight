import React from 'react';
import { ListBox, ListBoxItem, Text } from 'react-aria-components';
import { DataSourceBadge } from '../../ui/DataSourceBadge/DataSourceBadge';
import { RockGridProps } from './types';
import styles from './RockGrid.module.scss';

export const RockGrid: React.FC<RockGridProps> = ({
  rocks,
  selectedRocks,
  onSelectionChange,
  highlightedRocks,
  onRockHover,
}) => {
  return (
    <ListBox
      aria-label="Lunar Rocks"
      className={styles.rockGrid}
      layout="grid"
      selectionMode="multiple"
      selectedKeys={selectedRocks}
      onSelectionChange={onSelectionChange}
    >
      {rocks.map((rock) => {
        const isHighlighted = highlightedRocks.has(rock.id);

        return (
          <ListBoxItem
            key={rock.id}
            id={rock.id}
            textValue={rock.name}
            className={`${styles.rockItem} ${isHighlighted ? styles.highlighted : ''}`}
            onHoverStart={() => onRockHover(rock.id)}
            onHoverEnd={() => onRockHover(null)}
          >
            <div className={styles.rockItemContent}>
              {/* Data Source Badge */}
              <DataSourceBadge dataType={rock.dataType} />

              {/* Rock icon */}
              <div className={styles.rockIcon}>{rock.icon}</div>

              {/* Rock name */}
              <Text slot="description" className={styles.rockName}>
                {rock.name}
              </Text>

              {/* Rock types */}
              <Text slot="description" className={styles.rockType}>
                {rock.rockType}
              </Text>
            </div>
          </ListBoxItem>
        );
      })}
    </ListBox>
  );
};
