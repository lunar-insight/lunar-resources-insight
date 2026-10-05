import React, { useSyncExternalStore } from 'react';
import { Button } from 'react-aria-components';
import ModalOverlayContainer from 'components/layout/ModalOverlayContainer/ModalOverlayContainer';
import { ValueBar } from 'components/inspector/ValueBar/ValueBar';
import { CoverageIcon, EmptySlot } from 'components/inspector/RowIcons/RowIcons';
import { StatPopover } from 'components/inspector/StatPopover/StatPopover';
import { barView, CATEGORY_RGB } from 'components/inspector/lineView';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useInspectorContext, useLayerStatsVersion } from 'utils/context/InspectorContext';
import { layerStatsService } from 'services/LayerStatsService';
import { shapeWord } from 'services/inspector/featureGeometry';
import { inspectorGroups, inspectorLines, type InspectorLine } from 'services/inspector/inspectorLayers';
import type { FeatureResults, LineResult } from 'services/inspector/InspectorStore';
import { formatValue, highlightedCells, isRanked, showsCoverage } from 'services/inspector/inspectorStatistics';
import { comparisonCsv, downloadCsv } from 'services/inspector/inspectorCsv';
import styles from './ComparisonView.module.scss';

interface Column {
  feature: Feature;
  results?: FeatureResults;
}

const hasValue = (result?: LineResult): result is LineResult & { value: number } =>
  !!result && result.value !== undefined && !result.noData && !result.failed;

const coverageOf = (result: LineResult, kind?: FeatureResults['kind']) =>
  kind === 'point' ? undefined : result.stats?.coverage;

const Cell: React.FC<{ line: InspectorLine; column: Column; highlighted: boolean }> = ({ line, column, highlighted }) => {
  const result = column.results?.status === 'ready' ? column.results.lines[line.id] : undefined;
  if (!result) return <td className={styles.pending}>Computing</td>;

  const view = barView(line, result, layerStatsService.getFileStats(result.file.filename));
  const bar = <ValueBar view={view} categoryRgb={CATEGORY_RGB[line.category]} />;

  if (!hasValue(result)) {
    return (
      <td>
        <div className={styles.cell}>
          <span className={styles.barSet}>{bar}<EmptySlot /></span>
          <span className={`${styles.value} ${styles.noData}`}>
            {view.kind === 'no-data' && (
              <StatPopover content={view.popover} label="No data" className={styles.noDataText}>No data</StatPopover>
            )}
          </span>
        </div>
      </td>
    );
  }

  const coverage = coverageOf(result, column.results?.kind);
  const muted = !isRanked(coverage);
  return (
    <td className={muted ? styles.lowCoverage : highlighted ? styles.best : undefined}>
      <div className={styles.cell}>
        <span className={styles.barSet}>
          {bar}
          {showsCoverage(coverage) ? <CoverageIcon coverage={coverage} inComparison /> : <EmptySlot />}
        </span>
        <span className={styles.value}>{formatValue(result.value, line.decimals)}</span>
      </div>
    </td>
  );
};

/** Saved features side by side, one dataset per row, full screen over the globe. */
export const ComparisonView: React.FC = () => {
  const { features } = useFeaturesContext();
  const { store, comparedIds, isComparisonOpen, setComparisonOpen } = useInspectorContext();
  useSyncExternalStore(store.subscribe, store.getVersion);
  useLayerStatsVersion();

  const columns: Column[] = features
    .filter(feature => comparedIds.has(feature.id))
    .map(feature => ({ feature, results: store.get(feature.id) }));

  // The union of the dataset lines the compared features hold
  const shown = new Set(inspectorLines
    .filter(line => columns.some(column => column.results?.lines[line.id]))
    .map(line => line.id));
  const groups = inspectorGroups
    .map(group => ({
      ...group,
      cards: group.cards
        .map(card => ({ ...card, lines: card.lines.filter(line => shown.has(line.id)) }))
        .filter(card => card.lines.length > 0),
    }))
    .filter(group => group.cards.length > 0);

  const exportCsv = () => downloadCsv('feature-comparison.csv', comparisonCsv(inspectorLines, columns));

  return (
    <ModalOverlayContainer
      isOpen={isComparisonOpen}
      onOpenChange={setComparisonOpen}
      title="Compare features"
      modalId="feature-comparison-modal"
    >
      <div className={styles.view}>
        <div className={styles.scroll}>
          {columns.length === 0 ? (
            <p className={styles.message}>Tick features in the Features panel to compare them.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Layer</th>
                  {columns.map(({ feature }) => (
                    <th key={feature.id}>
                      <span className={styles.featureDot} style={{ background: feature.color }} />
                      {feature.name}
                      <span className={styles.sub}>
                        {shapeWord(feature.type)}{feature.type === 'point' ? '' : ' · average'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <React.Fragment key={group.category}>
                    <tr className={styles.categoryRow}>
                      <td colSpan={columns.length + 1} style={{ '--cat': CATEGORY_RGB[group.category] } as React.CSSProperties}>
                        {group.label}
                      </td>
                    </tr>
                    {group.cards.map(card => (
                      <React.Fragment key={card.symbol}>
                        <tr className={styles.symbolRow}>
                          <td colSpan={columns.length + 1}>
                            <b>{card.symbol}</b>
                            <span className={styles.symbolName}>{card.name}</span>
                            {card.lines[0].unit && <span className={styles.symbolName}>{card.lines[0].unit}</span>}
                          </td>
                        </tr>
                        {card.lines.map(line => {
                          // The highlight compares features within one dataset row
                          const highlighted = highlightedCells(columns.map(column => {
                            const result = column.results?.lines[line.id];
                            return hasValue(result) ? { value: result.value, coverage: coverageOf(result, column.results?.kind) } : null;
                          }));
                          return (
                            <tr key={line.id} className={styles.datasetRow}>
                              <td className={styles.datasetCell}>
                                {line.datasetLabel}
                                {line.variantLabel && <span className={styles.variant}>{line.variantLabel}</span>}
                              </td>
                              {columns.map((column, index) => (
                                <Cell key={column.feature.id} line={line} column={column} highlighted={highlighted.has(index)} />
                              ))}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={styles.footer}>
          <Button className={styles.textButton} onPress={exportCsv} isDisabled={columns.length === 0}>
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            Export CSV
          </Button>
        </div>
      </div>
    </ModalOverlayContainer>
  );
};
