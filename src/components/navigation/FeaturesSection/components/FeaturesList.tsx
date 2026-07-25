import React, { useState } from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useViewer } from 'utils/context/ViewerContext';
import RemoveItemButton from 'components/layout/Button/RemoveItemButton/RemoveItemButton';
import { FeatureColorButton } from './FeatureColorButton';
import { FeatureVisibilityButton } from './FeatureVisibilityButton';
import { FeatureInsightsButton } from './FeatureInsightsButton';
import { FeatureJumpButton } from './FeatureJumpButton';
import { FeatureNameEditor } from './FeatureNameEditor';
import { flyToFeature } from 'utils/featureUtils';
import styles from './FeaturesList.module.scss';

export const FeaturesList: React.FC = () => {
  const { features, removeFeature, toggleFeatureInsights, toggleFeatureVisible, renameFeature } = useFeaturesContext();
  const { viewer } = useViewer();
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);

  const handleStartEdit = (featureId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingFeatureId(featureId);
  };

  const handleSaveEdit = (featureId: string, newName: string) => {
    renameFeature(featureId, newName);
    setEditingFeatureId(null);
  };

  const handleCancelEdit = () => {
    setEditingFeatureId(null);
  };

  if (features.length === 0) {
    return (
      <div className={styles.selectionFrame}>
        <span className={styles.placeholder}>No features selected</span>
      </div>
    );
  }

  return (
    <div className={styles.selectionFrame}>
      <GridList
        items={features}
        selectionMode="none"
        className={styles.featuresList}
        aria-label="Features list"
        dependencies={[editingFeatureId]}
      >
        {(feature) => {
          const isEditing = editingFeatureId === feature.id;

          return (
          <GridListItem
            key={feature.id}
            textValue={feature.name}
            className={styles.featureItem}
          >
            <div className={styles.featureItemHeader}>
              {isEditing ? (
                <FeatureNameEditor
                  initialName={feature.name}
                  onSave={(newName) => handleSaveEdit(feature.id, newName)}
                  onCancel={handleCancelEdit}
                />
              ) : (
                <>
                  <FeatureColorButton
                    featureId={feature.id}
                    currentColor={feature.color}
                  />

                  <span
                    className={styles.featureName}
                    onClick={(e) => handleStartEdit(feature.id, e)}
                    title="Click to rename"
                  >
                    {feature.name}
                  </span>

                  <div className={styles.featureActions}>
                    <FeatureJumpButton
                      onPress={() => flyToFeature(viewer, feature)}
                    />

                    <FeatureVisibilityButton
                      isVisible={feature.visible}
                      onChange={() => toggleFeatureVisible(feature.id)}
                    />

                    <FeatureInsightsButton
                      isSelected={feature.insightsOpen}
                      onChange={() => toggleFeatureInsights(feature.id)}
                    />

                    <RemoveItemButton
                      onPress={() => removeFeature(feature.id)}
                      icon='delete'
                      label='Remove shape'
                      ariaLabel='remove shape'
                      variant='danger'
                    />
                  </div>
                </>
              )}
            </div>
          </GridListItem>
          );
        }}
      </GridList>
    </div>
  );
};
