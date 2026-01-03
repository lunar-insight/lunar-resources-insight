import React, {ReactNode, useState } from 'react';
import {
  GridListItemProps, GridListProps,
  Button, GridList, GridListItem, useDragAndDrop,
  Disclosure, DisclosurePanel, Heading
} from 'react-aria-components';
import styles from './GridListLayerComponent.module.scss';
import RemoveLayerButton from '../Button/RemoveLayerButton/RemoveLayerButton';
import { LayerVisibilityCheckbox } from '../Checkbox/LayerVisibilityCheckbox/LayerVisibilityCheckbox';
import { useLayerContext } from 'utils/context/LayerContext';

interface GridListLayerProps<T extends { id: string | number }> extends Omit<GridListProps<T>, 'children'> {
  items: T[];
  children: ((item: T) => ReactNode) | ReactNode;
  onReorder?: (newItems: T[]) => void;
  centerText?: React.ReactNode;
}

interface GridListLayerItemProps<T> extends Omit<GridListItemProps, 'children'> {
  children: ReactNode;
  accordionContent?: ReactNode;
  onRemove?: () => void;
  category?: string;
  isFirstOfNewCategory?: boolean;
}

export function GridListLayer<T extends { id: string | number }>({
  children,
  items,
  onReorder,
  centerText,
  ...props
}: GridListLayerProps<T>) {

  const dragAndDropHooks = useDragAndDrop({

    getItems: (keys) =>
      Array.from(keys).map((key) => {
        const item = items.find(item => item.id === key);
        return { 'text/plain': JSON.stringify(item)};
      }),

    onReorder(e) {
      if (!onReorder) return;

      const targetKey = e.target.key;

      // Get items being moved
      const movedItems = Array.from(e.keys).map(key => {
        return items.find(item => item.id === key);
      }).filter(Boolean) as T[];

      // Set for for fast lookup when filtering items 0(n) linear time
      const movedItemIds = new Set(movedItems.map(item => item.id));

      // Filter: keep only items that are not moving
      const itemsToKeep = items.filter(item => !movedItemIds.has(item.id));

      // Find: position of target in filtered list
      const targetPosition = itemsToKeep.findIndex(item => item.id === targetKey);

      // Special case: target is one of the moved items, do nothing
      if (targetPosition === -1) {
        return;
      }

      // Rebuild: assemble the new array
      let newItems: T[];

      if (e.target.dropPosition === 'before') {
        // Insert before the target
        newItems = [
          ...itemsToKeep.slice(0, targetPosition),  // Items before target
          ...movedItems,                             // Moved items
          ...itemsToKeep.slice(targetPosition)       // Target + items after
        ];
      } else if (e.target.dropPosition === 'after') {
        // Insert AFTER the target
        newItems = [
          ...itemsToKeep.slice(0, targetPosition + 1),  // Items up to and including target
          ...movedItems,                                 // Moved items
          ...itemsToKeep.slice(targetPosition + 1)       // Items after target
        ];
      } else {
        return; // Unknown position
      }

      // Check if the order actually changed
      const orderUnchanged = newItems.length === items.length &&
                             newItems.every((item, index) => item.id === items[index].id);

      if (!orderUnchanged) {
        onReorder(newItems);
      }
    }
  });

  return (
    <div className={styles.gridListLayerComponent}>

      <GridList
        {...props}
        items={items}
        {...dragAndDropHooks}
      >
        {(item) => (
            typeof children === 'function' ? children(item) : children
        )}
      </GridList>
      {items.length === 0 && centerText && <div className={styles.centerText}>{centerText}</div>}
    </div>
  );
}

export function GridListLayerItem<T extends { id: string | number }>({
  children,
  accordionContent,
  onRemove,
  layerId,
  textValue,
  category,
  isFirstOfNewCategory,
  ...props
}: GridListLayerItemProps<T> & { textValue: string; layerId: string }) {
  const { visibleLayers, toggleLayerVisibility } = useLayerContext();

  // Ensure textValue is always a valid string for drag and drop to work
  const effectiveTextValue = textValue || (typeof children === 'string' ? children : String(layerId));

  return (
    <GridListItem
      textValue={effectiveTextValue}
      className={styles.gridListItem}
      data-category={category}
      data-first-of-category={isFirstOfNewCategory ? "true" : "false"}
      {...props}
    >
      {({ selectionMode, selectionBehavior }) => (
        <>
          <Button slot="drag" className={styles.gridListItemHeaderDrag}>≡</Button>

          {accordionContent ? (
            // With disclosure/accordion content
            <Disclosure className={styles.disclosure}>
              {({ isExpanded }) => (
                <>
                  <div className={styles.gridListItemHeader}>
                    {selectionMode === 'multiple' && selectionBehavior === 'toggle' && (
                      <LayerVisibilityCheckbox
                        slot="selection"
                        isSelected={visibleLayers.has(layerId)}
                        onChange={() => toggleLayerVisibility(layerId)}
                      />
                    )}

                    <div
                      className={styles.gridListItemHeaderItemText}
                      title={typeof children === 'string' ? children : undefined}
                    >
                      {children}
                    </div>

                    <Heading>
                      <Button
                        slot="trigger"
                        className={styles.gridListItemHeaderAccordionHeader}
                      >
                        <i className={`${styles.gridListItemHeaderAccordionHeaderIcon} material-symbols-outlined`}>
                          {isExpanded ? 'arrow_drop_up' : 'arrow_drop_down'}
                        </i>
                        <span className={styles.gridListItemHeaderAccordionHeaderText}>
                          {isExpanded ? 'Hide' : 'Show'}
                        </span>
                      </Button>
                    </Heading>

                    <div className={styles.gridListItemHeaderRemoveLayerWrapper}>
                      <RemoveLayerButton onPress={onRemove} />
                    </div>
                  </div>

                  <DisclosurePanel
                    className={`${styles.gridListItemAccordionContentWrapper} ${
                      isExpanded ? styles.expanded : ''
                    }`}
                  >
                    <div className={styles.gridListItemAccordionContentWrapperMain}>
                      {accordionContent}
                    </div>
                  </DisclosurePanel>
                </>
              )}
            </Disclosure>
          ) : (
            <div className={styles.gridListItemHeader}>
              {selectionMode === 'multiple' && selectionBehavior === 'toggle' && (
                <LayerVisibilityCheckbox
                  slot="selection"
                  isSelected={visibleLayers.has(layerId)}
                  onChange={() => toggleLayerVisibility(layerId)}
                />
              )}

              <div
                className={styles.gridListItemHeaderItemText}
                title={typeof children === 'string' ? children : undefined}
              >
                {children}
              </div>

              <div className={styles.gridListItemHeaderRemoveLayerWrapper}>
                <RemoveLayerButton onPress={onRemove} />
              </div>
            </div>
          )}
        </>
      )}
    </GridListItem>
  );
}