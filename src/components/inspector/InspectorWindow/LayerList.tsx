import React from 'react';
import { lineCount, type InspectorGroup } from 'services/inspector/inspectorLayers';
import type { FeatureResults } from 'services/inspector/InspectorStore';
import type { SparkScale } from 'components/inspector/Sparkline/Sparkline';
import { CATEGORY_RGB } from 'components/inspector/lineView';
import { DatasetLine, type ChartControl } from './DatasetLine';
import styles from './InspectorWindow.module.scss';

interface LayerListProps {
  groups: InspectorGroup[];
  results: FeatureResults;
  sparkScale: SparkScale;
  chartControl?: (lineId: string, unit?: string) => ChartControl | undefined;
}

/** Cards by category, one per symbol, one line per dataset reporting it. */
export const LayerList: React.FC<LayerListProps> = ({ groups, results, sparkScale, chartControl }) => {
  const lengthKm = results.samples?.[results.samples.length - 1]?.distanceKm ?? 0;
  const fractions = (results.samples ?? []).map(s => (lengthKm > 0 ? s.distanceKm / lengthKm : 0));

  if (groups.length === 0) {
    return <p className={styles.emptyList}>No layer matches the filter.</p>;
  }

  return (
    <>
      {groups.map(group => (
        <section key={group.category} aria-label={group.label}>
          <div className={styles.group} style={{ '--cat': CATEGORY_RGB[group.category] } as React.CSSProperties}>
            <span>{group.label}</span>
            <span className={styles.groupCount}>{lineCount(group)}</span>
            <span className={styles.rule} />
          </div>
          {group.cards.map(card => (
            <div key={card.symbol} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.symbol}>{card.symbol}</span>
                <span className={styles.cardName}>{card.name}</span>
                {card.lines.length > 1 && <span className={styles.datasetCount}>{card.lines.length} datasets</span>}
              </div>
              {card.lines.map(line => {
                const result = results.lines[line.id];
                if (!result) return null;
                return (
                  <DatasetLine
                    key={line.id}
                    line={line}
                    result={result}
                    results={results}
                    sparkScale={sparkScale}
                    sparkFractions={fractions}
                    chart={chartControl?.(line.id, line.unit)}
                  />
                );
              })}
            </div>
          ))}
        </section>
      ))}
    </>
  );
};
