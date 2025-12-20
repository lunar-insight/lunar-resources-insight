import React, {ReactNode, useState } from 'react';
import {
  GridListItemProps, GridListProps,
  Button, GridList, GridListItem, useDragAndDrop,
  Disclosure, DisclosurePanel, Heading 
} from 'react-aria-components';
import './GridListLayerComponent.scss';
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
    <div className='grid-list-layer-component'>

      <GridList 
        {...props} 
        items={items}
        {...dragAndDropHooks}
      >
        {(item) => (
            typeof children === 'function' ? children(item) : children
        )}
      </GridList>
      {items.length === 0 && centerText && <div className='grid-list-layer-component__center-text'>{centerText}</div>}
    </div>
  );
}

export function GridListLayerItem<T extends { id: string | number }>({ 
  children, 
  accordionContent,
  onRemove, 
  layerId,
  ...props 
}: GridListLayerItemProps<T> & { textValue: string; layerId: string }) {
  const { visibleLayers, toggleLayerVisibility } = useLayerContext();
  
  let textValue = typeof children === 'string' ? children : undefined;
  
  return (
    <GridListItem textValue={textValue} className='grid-list-layer-component__grid-list-item' {...props}>
      {({ selectionMode, selectionBehavior }) => (
        accordionContent ? (
          // With disclosure/accordion content
          <Disclosure className="grid-list-layer-component__disclosure">
            {({ isExpanded }) => (
              <>
                <div className='grid-list-layer-component__grid-list-item__header'>
                  <div className='grid-list-layer-component__grid-list-item__header__drag'>≡</div>
                  
                  {selectionMode === 'multiple' && selectionBehavior === 'toggle' && (
                    <LayerVisibilityCheckbox 
                      slot="selection"
                      isSelected={visibleLayers.has(layerId)}
                      onChange={() => toggleLayerVisibility(layerId)}
                    />
                  )}
                  
                  <div className="grid-list-layer-component__grid-list-item__header__item-text">
                    {children}
                  </div>
                  
                  <Heading>
                    <Button 
                      slot="trigger"
                      className='grid-list-layer-component__grid-list-item__header__accordion-header'
                    >
                      <i className='grid-list-layer-component__grid-list-item__header__accordion-header__icon material-symbols-outlined'>
                        {isExpanded ? 'arrow_drop_up' : 'arrow_drop_down'}
                      </i>
                      <span className='grid-list-layer-component__grid-list-item__header__accordion-header__text'>
                        {isExpanded ? 'Hide' : 'Show'}
                      </span>
                    </Button>
                  </Heading>
                  
                  <div className='grid-list-layer-component__grid-list-item__header__remove-layer-wrapper'>
                    <RemoveLayerButton onPress={onRemove} />
                  </div>
                </div>
                
                <DisclosurePanel 
                  className={`grid-list-layer-component__grid-list-item__accordion-content-wrapper ${
                    isExpanded ? 'expanded' : ''
                  }`}
                >
                  <div className='grid-list-layer-component__grid-list-item__accordion-content-wrapper__main'>
                    {accordionContent}
                  </div>
                </DisclosurePanel>
              </>
            )}
          </Disclosure>
        ) : (
          <div className='grid-list-layer-component__grid-list-item__header'>
            <div className='grid-list-layer-component__grid-list-item__header__drag'>≡</div>
            
            {selectionMode === 'multiple' && selectionBehavior === 'toggle' && (
              <LayerVisibilityCheckbox 
                slot="selection"
                isSelected={visibleLayers.has(layerId)}
                onChange={() => toggleLayerVisibility(layerId)}
              />
            )}
            
            <div className="grid-list-layer-component__grid-list-item__header__item-text">
              {children}
            </div>
            
            <div className='grid-list-layer-component__grid-list-item__header__remove-layer-wrapper'>
              <RemoveLayerButton onPress={onRemove} />
            </div>
          </div>
        )
      )}
    </GridListItem>
  );
}