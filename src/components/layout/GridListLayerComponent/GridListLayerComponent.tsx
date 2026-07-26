import React, { ReactNode } from 'react';
import {
  GridListItemProps, GridListProps,
  Button, GridList, GridListItem, useDragAndDrop,
  Disclosure, DisclosurePanel, Heading
} from 'react-aria-components';
import styles from './GridListLayerComponent.module.scss';
import RemoveItemButton from '../Button/RemoveItemButton/RemoveItemButton';
import { LayerVisibilityCheckbox } from '../Checkbox/LayerVisibilityCheckbox/LayerVisibilityCheckbox';
import { useLayerContext } from 'utils/context/LayerContext';
import { elementToAccentColor, elementToSymbol, compoundToAccentColor, compoundToFormula } from 'utils/colorUtils';
import { LayerRole } from 'services/StacService';

const ROLE_ICON: Record<LayerRole, { icon: string; color: string; tooltip: string }> = {
  Measured: { icon: 'straighten', color: 'hsl(120, 45%, 62%)', tooltip: 'Measured (direct instrument reading)' },
  Modeled: { icon: 'model_training', color: 'hsl(250, 62%, 75%)', tooltip: 'Modeled (ML model, indirect signal)' },
  Estimated: { icon: 'functions', color: 'hsl(330, 45%, 72%)', tooltip: 'Estimated (computed from other layers)' },
  Indicator: { icon: 'sensors', color: 'hsl(173, 60%, 50%)', tooltip: 'Indicator (proxy signal, not a real quantity)' },
};

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
  element?: string;
  compound?: string;
  isFirstOfNewCategory?: boolean;
  role?: LayerRole;
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
  element,
  compound,
  isFirstOfNewCategory,
  role,
  ...props
}: GridListLayerItemProps<T> & { textValue: string; layerId: string }) {
  const { visibleLayers, toggleLayerVisibility } = useLayerContext();

  const effectiveTextValue = textValue || (typeof children === 'string' ? children : String(layerId));

  const accentColor = element
    ? elementToAccentColor(element)
    : compound
      ? compoundToAccentColor(compound)
      : undefined;

  const badge = element ? (
    <span className={styles.elBadge} aria-label={element}>
      {elementToSymbol(element)}
    </span>
  ) : compound ? (
    <span className={styles.elBadge} aria-label={compound}>
      {compoundToFormula(compound)}
    </span>
  ) : null;

  const titleText = typeof children === 'string' ? children : effectiveTextValue;
  const dotIndex = titleText.indexOf('·');
  const quantityLine = dotIndex === -1 ? titleText : titleText.slice(0, dotIndex).trim();
  const instrumentLine = dotIndex === -1 ? undefined : titleText.slice(dotIndex + 1).trim();

  const titleBlock = (
    <div
      className={styles.gridListItemHeaderItemText}
      title={typeof children === 'string' ? children : undefined}
    >
      <span className={styles.titleLine1}>{quantityLine}</span>
      {instrumentLine && <span className={styles.titleLine2}>{instrumentLine}</span>}
    </div>
  );

  const roleIcon = role ? (
    <span
      className={styles.roleIcon}
      style={{ '--role-color': ROLE_ICON[role].color } as React.CSSProperties}
      title={ROLE_ICON[role].tooltip}
    >
      <i className="material-symbols-outlined">{ROLE_ICON[role].icon}</i>
    </span>
  ) : null;

  return (
    <GridListItem
      textValue={effectiveTextValue}
      className={styles.gridListItem}
      data-category={category}
      data-element={element ?? undefined}
      data-compound={compound ?? undefined}
      data-first-of-category={isFirstOfNewCategory ? "true" : "false"}
      style={accentColor ? { '--el-accent-color': accentColor } as React.CSSProperties : undefined}
      {...props}
    >
      {() => (
        <>
          <Button slot="drag" className={styles.gridListItemHeaderDrag}>
            <i className="material-symbols-outlined">reorder</i>
          </Button>

          {accordionContent ? (
            <Disclosure className={styles.disclosure}>
              {({ isExpanded }) => (
                <>
                  <div className={styles.gridListItemHeader}>
                    <LayerVisibilityCheckbox
                      isSelected={visibleLayers.has(layerId)}
                      onChange={() => toggleLayerVisibility(layerId)}
                    />

                    {badge}

                    {titleBlock}

                    {roleIcon}

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
                      <RemoveItemButton onPress={onRemove} />
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
              <LayerVisibilityCheckbox
                isSelected={visibleLayers.has(layerId)}
                onChange={() => toggleLayerVisibility(layerId)}
              />

              {badge}

              {titleBlock}

              {roleIcon}

              <div className={styles.gridListItemHeaderRemoveLayerWrapper}>
                <RemoveItemButton onPress={onRemove} />
              </div>
            </div>
          )}
        </>
      )}
    </GridListItem>
  );
}