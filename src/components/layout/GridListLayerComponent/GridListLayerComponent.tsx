import React, {ReactNode, useState } from 'react';
import {
  GridListItemProps, GridListProps,
  Button, GridList, GridListItem, useDragAndDrop,
  Disclosure, DisclosurePanel, Heading 
} from 'react-aria-components';
import './GridListLayerComponent.scss';
import RemoveLayerButton from '../Button/RemoveLayerButton/RemoveLayerButton';
import { LayerVisibilityCheckbox } from '../Checkbox/LayerVisibilityCheckbox';
import { useLayerContext } from 'utils/context/LayerContext';

interface GridListLayerProps<T extends { id: string | number }> extends Omit<GridListProps<T>, 'children'> {
  items: T[];
  children: ((item: T) => ReactNode) | ReactNode;
  onReorder?: (newItems: T[]) => void;
  centerText?: string;
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
        const numericKey = typeof key === 'string' ? Number(key) : key;
        const item = items.find(item => item.id === numericKey);
        return { 'text/plain': JSON.stringify(item)};
      }),

    onReorder(e) {
      if (!onReorder) return;

      const targetKey = typeof e.target.key === 'string' ? Number(e.target.key) : e.target.key;
      const targetIndex = items.findIndex(item => item.id === targetKey);
      const movedItems = Array.from(e.keys).map(key => {
        const numericKey = typeof key === 'string' ? Number(key) : key;
        return items.find(item => item.id === numericKey);
      }).filter(Boolean) as T[];

      if (e.target.dropPosition === 'before') {
        const newItems = [...items];
        movedItems.forEach(item => {
          const currentIndex = newItems.findIndex(i => i.id === item.id);
          newItems.splice(currentIndex, 1);
          newItems.splice(targetIndex, 0, item);
        });
        onReorder(newItems);
      } else if (e.target.dropPosition === 'after') {
        const newItems = [...items];
        const insertionIndex = targetIndex + 1;
        movedItems.forEach(item => {
          const currentIndex = newItems.findIndex(i => i.id === item.id);
          newItems.splice(currentIndex, 1);
          newItems.splice(insertionIndex, 0 , item);
        });
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