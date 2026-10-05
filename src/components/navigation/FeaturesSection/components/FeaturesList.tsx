import React, { useState } from 'react';
import { Button, GridList, GridListItem } from 'react-aria-components';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useViewer } from 'utils/context/ViewerContext';
import { useFeatureResults, useInspectorContext } from 'utils/context/InspectorContext';
import RemoveItemButton from 'components/layout/Button/RemoveItemButton/RemoveItemButton';
import { Checkbox } from 'components/layout/Checkbox/Checkbox/Checkbox';
import { FeatureColorButton } from './FeatureColorButton';
import { FeatureVisibilityButton } from './FeatureVisibilityButton';
import { FeatureInspectButton } from './FeatureInspectButton';
import { FeatureJumpButton } from './FeatureJumpButton';
import { FeatureNameEditor } from './FeatureNameEditor';
import { flyToFeature } from 'utils/featureUtils';
import { shapeWord } from 'services/inspector/featureGeometry';
import type { Feature } from '../types';
import styles from './FeaturesList.module.scss';

const SHAPE_ICONS: Record<string, string> = {
  point: 'location_on',
  line: 'timeline',
  polygon: 'hexagon',
  circle: 'circle',
};

/** Shape type, then the computation progress or the ready state, counted in dataset lines. */
const FeatureStatus: React.FC<{ feature: Feature }> = ({ feature }) => {
  const results = useFeatureResults(feature.id);
  const computing = !results || results.status === 'computing';

  return (
    <span className={styles.featureStatus}>
      <span className={styles.shapeLabel}>{shapeWord(feature.type)}</span>
      <span aria-hidden="true">·</span>
      {computing ? (
        <>
          <span className={styles.miniProgress} aria-hidden="true">
            <span style={{ width: `${results ? (results.done / results.total) * 100 : 0}%` }} />
          </span>
          <span>{results ? `${results.done} of ${results.total} layers` : 'Computing'}</span>
        </>
      ) : (
        <span>{results.total} layers ready</span>
      )}
    </span>
  );
};

export const FeaturesList: React.FC = () => {
  const { features, removeFeature, toggleFeatureInspector, toggleFeatureVisible, renameFeature } = useFeaturesContext();
  const { comparedIds, toggleCompared, setComparisonOpen } = useInspectorContext();
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

  const ticked = features.filter(feature => comparedIds.has(feature.id)).length;

  return (
    <div className={styles.selectionFrame}>
      <GridList
        items={features}
        selectionMode="none"
        className={styles.featuresList}
        aria-label="Features list"
        dependencies={[editingFeatureId, comparedIds]}
      >
        {(feature) => {
          const isEditing = editingFeatureId === feature.id;
          const word = shapeWord(feature.type);

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
                  <Checkbox
                    size="md"
                    aria-label="Add to comparison"
                    isSelected={comparedIds.has(feature.id)}
                    onChange={() => toggleCompared(feature.id)}
                  />

                  <FeatureColorButton
                    featureId={feature.id}
                    currentColor={feature.color}
                  />

                  <span className={`material-symbols-outlined ${styles.shapeIcon}`} title={word} aria-hidden="true">
                    {SHAPE_ICONS[word]}
                  </span>

                  <span className={styles.featureMain}>
                    <span
                      className={styles.featureName}
                      onClick={(e) => handleStartEdit(feature.id, e)}
                      title="Click to rename"
                    >
                      {feature.name}
                    </span>
                    <FeatureStatus feature={feature} />
                  </span>

                  <div className={styles.featureActions}>
                    <FeatureJumpButton
                      onPress={() => flyToFeature(viewer, feature)}
                    />

                    <FeatureVisibilityButton
                      isVisible={feature.visible}
                      onChange={() => toggleFeatureVisible(feature.id)}
                    />

                    <FeatureInspectButton
                      isSelected={feature.inspectorOpen}
                      onChange={() => toggleFeatureInspector(feature.id)}
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

      <div className={styles.compareFooter}>
        <span>{ticked} ticked</span>
        <Button
          className={styles.compareButton}
          isDisabled={ticked === 0}
          onPress={() => setComparisonOpen(true)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">compare_arrows</span>
          Compare ({ticked})
        </Button>
      </div>
    </div>
  );
};
