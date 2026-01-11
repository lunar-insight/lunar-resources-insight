import React from 'react';
import { GridList, GridListItem } from 'react-aria-components';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import RemoveLayerButton from 'components/layout/Button/RemoveLayerButton/RemoveLayerButton';
import { FeatureInsightsButton } from './FeatureInsightsButton';
import styles from './FeaturesList.module.scss';

export const FeaturesList: React.FC = () => {
  const { features, removeFeature, toggleFeatureInsights } = useFeaturesContext();

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
      >
        {(feature) => (
          <GridListItem
            key={feature.id}
            textValue={feature.name}
            className={styles.featureItem}
          >
            <div className={styles.featureItemHeader}>
              <span className={styles.featureName}>{feature.name}</span>

              <div className={styles.featureActions}>
                <FeatureInsightsButton
                  isSelected={feature.insightsOpen}
                  onChange={() => toggleFeatureInsights(feature.id)}
                />

                <RemoveLayerButton onPress={() => removeFeature(feature.id)} />
              </div>
            </div>
          </GridListItem>
        )}
      </GridList>
    </div>
  );
};
