import React, {ReactNode, useState } from 'react';
import {
  CheckboxProps, GridListItemProps, GridListProps,
  Button, Checkbox, GridList, GridListItem, useDragAndDrop 
} from 'react-aria-components';
import './GridListLayerComponent.scss';

interface GridListLayerProps<T extends { id: string | number }> extends Omit<GridListProps<T>, 'children'> {
  items: T[];
  children: ((item: T) => ReactNode) | ReactNode;
  onReorder?: (newItems: T[]) => void;
  centerText?: string;
}

interface GridListLayerItemProps<T> extends Omit<GridListItemProps, 'children'> {
  children: ReactNode;
  accordionContent?: ReactNode;
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
  ...props 
}: GridListLayerItemProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  let textValue = typeof children === 'string' ? children : undefined;
  
  const toggleAccordion = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <GridListItem textValue={textValue} className='grid-list-layer-component__grid-list-item' {...props}>
      {({ selectionMode, selectionBehavior }) => (
        <>
          <div className='grid-list-layer-component__grid-list-item__header'>
            <Button slot="drag" className='grid-list-layer-component__grid-list-item__header__drag'>≡</Button>
            {selectionMode === 'multiple' && selectionBehavior === 'toggle' && (
              <MyCheckbox slot="selection"  className='grid-list-layer-component__grid-list-item__header__checkbox' />
            )}
            <div className="grid-list-layer-component__grid-list-item__header__item-text">
              {children}
            </div>
            {accordionContent && (
              <Button
                onPress={toggleAccordion}
                aria-expanded={isExpanded}
                className='grid-list-layer-component__grid-list-item__header__accordion-header'
              >
                {isExpanded ? 'Hide options' : 'Show options'}
              </Button>
            )}
            <div className='grid-list-layer-component__grid-list-item__header__remove-layer-wrapper' />
          </div>
          {/* Always render accordion content */}
          {accordionContent && (
            <div 
              className={`grid-list-layer-component__grid-list-item__accordion-content-wrapper ${isExpanded ? 'expanded' : ''}`}
            >
              <div className='grid-list-layer-component__grid-list-item__accordion-content-wrapper__main'>
                {accordionContent}
              </div>
            </div>
          )}
        </>
      )}
    </GridListItem>
  );
}

function MyCheckbox({ children, ...props }: CheckboxProps) {
  return (
    <Checkbox {...props}>
      {({ isIndeterminate }) => (
        <>
          <div className="checkbox">
            <svg viewBox="0 0 18 18" aria-hidden="true">
              {isIndeterminate
                ? <rect x={1} y={7.5} width={15} height={3} />
                : <polyline points="1 9 7 14 15 4" />}
            </svg>
          </div>
          {children}
        </>
      )}
    </Checkbox>
  );
}

