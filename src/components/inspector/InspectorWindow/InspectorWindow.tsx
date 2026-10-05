import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  TooltipTrigger,
} from 'react-aria-components';
import DraggableBoxContentContainer from 'components/layout/DraggableBoxContentContainer/DraggableBoxContentContainer';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { ProfileChart } from 'components/inspector/ProfileChart/ProfileChart';
import type { SparkScale } from 'components/inspector/Sparkline/Sparkline';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import { useBoundaryRef } from 'components/reference/BoundaryRefProvider';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useFeatureResults, useInspectorContext, useLayerStatsVersion } from 'utils/context/InspectorContext';
import { featureFacts, shapeWord } from 'services/inspector/featureGeometry';
import { filterGroups, inspectorGroups, inspectorLines, type InspectorLine } from 'services/inspector/inspectorLayers';
import type { FeatureResults } from 'services/inspector/InspectorStore';
import { colorOf, isUnitFull, togglePick, type ChartSelection } from 'services/inspector/chartSelection';
import { csvFileName, downloadCsv, profileCsv, statisticsCsv } from 'services/inspector/inspectorCsv';
import { LayerList } from './LayerList';
import styles from './InspectorWindow.module.scss';

export const INSPECTOR_WIDTH = 440;

// Units with a chart, in the order lines first use them
const CHART_UNITS = [...new Set(inspectorLines.map(line => line.unit).filter((u): u is string => !!u))];

const formatMeters = (meters: number) => `${Math.round(meters).toLocaleString('en-US')} m`;

function elevationFact(results?: FeatureResults): { value: string; hint: string } | null {
  const elevation = results?.elevation;
  if (!elevation) return null;
  if (results.kind === 'point') return { value: formatMeters(elevation.value), hint: 'Elevation at the point' };
  const over = results.kind === 'line' ? 'along the line' : 'over the area';
  return {
    value: `${formatMeters(elevation.value)} mean`,
    hint: `Mean ${over}. Lowest ${formatMeters(elevation.lowest)}, highest ${formatMeters(elevation.highest)}`,
  };
}

const ToolbarButton: React.FC<{ icon: string; label: string; onPress?: () => void }> = ({ icon, label, onPress }) => (
  <TooltipTrigger delay={400}>
    <Button aria-label={label} className={styles.iconButton} onPress={onPress}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </Button>
    <ButtonTooltip placement="bottom">{label}</ButtonTooltip>
  </TooltipTrigger>
);

interface InspectorWindowProps {
  feature: Feature;
  cascadeIndex: number;
}

export const InspectorWindow: React.FC<InspectorWindowProps> = ({ feature, cascadeIndex }) => {
  const boundaryRef = useBoundaryRef();
  const { toggleFeatureInspector } = useFeaturesContext();
  const { store, addCompared, setComparisonOpen, retryMissingStatistics } = useInspectorContext();
  const results = useFeatureResults(feature.id);
  useLayerStatsVersion();

  const [query, setQuery] = useState('');
  const [sparkScale, setSparkScale] = useState<SparkScale>('moon');
  const [chart, setChart] = useState<ChartSelection>({ picks: [], unit: CHART_UNITS.includes('wt%') ? 'wt%' : CHART_UNITS[0] });

  // Opening the Inspector retries the whole Moon statistics still missing.
  useEffect(() => {
    if (feature.inspectorOpen) retryMissingStatistics();
  }, [feature.inspectorOpen, retryMissingStatistics]);

  const groups = useMemo(() => filterGroups(inspectorGroups, query), [query]);
  const isLine = results?.kind === 'line';
  const elevation = elevationFact(results);
  const lengthKm = results?.samples?.[results.samples.length - 1]?.distanceKm ?? 0;

  const exportStatistics = () => {
    if (results) downloadCsv(csvFileName(feature.name, 'statistics'), statisticsCsv(inspectorLines, results));
  };
  const exportProfile = () => {
    if (results) downloadCsv(csvFileName(feature.name, 'profile'), profileCsv(inspectorLines, results));
  };

  const togglePickedLine = (line: InspectorLine) => {
    if (line.unit) setChart(current => togglePick(current, line.id, line.unit!));
  };
  const chartControl = isLine
    ? (lineId: string, unit?: string) => {
      if (!unit) return undefined;
      const line = inspectorLines.find(l => l.id === lineId)!;
      return { color: colorOf(chart, lineId), isFull: isUnitFull(chart, unit), onToggle: () => togglePickedLine(line) };
    }
    : undefined;

  const computing = !results || results.status === 'computing';

  return (
    <DraggableBoxContentContainer
      tone="dark"
      isOpen={feature.inspectorOpen}
      onClose={() => toggleFeatureInspector(feature.id)}
      title={(
        <span className={styles.title}>
          <span className={styles.featureDot} style={{ background: feature.color }} />
          <span className={styles.titleText}>Inspector: {feature.name}</span>
        </span>
      )}
      boundaryRef={boundaryRef}
      cascadeIndex={cascadeIndex}
      width={INSPECTOR_WIDTH}
      id={`feature-inspector-${feature.id}`}
      contentClassName={styles.windowContent}
    >
      <div className={styles.meta}>
        <span>Type <b>{shapeWord(feature.type)}</b></span>
        {featureFacts(feature).map(fact => (
          <span key={fact.label}>{fact.label} <b>{fact.value}</b></span>
        ))}
        {elevation && (
          <span className={styles.hint} title={elevation.hint}>Elevation <b>{elevation.value}</b></span>
        )}
      </div>

      {isLine && results && (
        <ProfileChart
          lines={inspectorLines}
          results={results}
          selection={chart}
          units={CHART_UNITS}
          lengthKm={lengthKm}
          onSelectUnit={unit => setChart(current => ({ ...current, unit }))}
          onTogglePick={togglePickedLine}
        />
      )}

      <div className={styles.toolbar}>
        <TextField aria-label="Filter layers" value={query} onChange={setQuery} isDisabled={computing} className={styles.filter}>
          <Input placeholder="Filter layers" className={styles.filterInput} />
        </TextField>
        {isLine ? (
          <MenuTrigger>
            <TooltipTrigger delay={400}>
              <Button aria-label="Export CSV: statistics or profile" className={styles.iconButton} isDisabled={computing}>
                <span className="material-symbols-outlined" aria-hidden="true">download</span>
              </Button>
              <ButtonTooltip placement="bottom">Export CSV: statistics or profile</ButtonTooltip>
            </TooltipTrigger>
            <Popover className={styles.menuPopover} placement="bottom end">
              <Menu className={styles.menu} onAction={key => (key === 'profile' ? exportProfile() : exportStatistics())}>
                <MenuItem id="statistics" className={styles.menuItem}>Statistics</MenuItem>
                <MenuItem id="profile" className={styles.menuItem}>Profile</MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        ) : (
          <TooltipTrigger delay={400}>
            <Button aria-label="Export CSV" className={styles.iconButton} onPress={exportStatistics} isDisabled={computing}>
              <span className="material-symbols-outlined" aria-hidden="true">download</span>
            </Button>
            <ButtonTooltip placement="bottom">Export CSV</ButtonTooltip>
          </TooltipTrigger>
        )}
        <ToolbarButton
          icon="compare_arrows"
          label="Compare features"
          onPress={() => {
            addCompared(feature.id);
            setComparisonOpen(true);
          }}
        />
      </div>

      {isLine && (
        <div className={styles.sparkScale}>
          Sparklines
          <ToggleButtonGroup
            aria-label="Sparkline scale"
            isDisabled={computing}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[sparkScale]}
            onSelectionChange={keys => {
              const [next] = [...keys];
              if (next) setSparkScale(next as SparkScale);
            }}
            className={styles.pills}
          >
            <ToggleButton id="moon" className={styles.pill}>Moon scale</ToggleButton>
            <ToggleButton id="own" className={styles.pill}>Own range</ToggleButton>
          </ToggleButtonGroup>
        </div>
      )}

      {!computing && results.failedRequests > 0 && (
        <div className={styles.notice} role="status">
          <span>Some values could not be computed.</span>
          <Button className={styles.textButton} onPress={() => store.retry(feature.id)}>Retry</Button>
        </div>
      )}

      <div className={styles.content}>
        {computing ? (
          <div className={styles.computing} role="status">
            <span>Computing</span>
            {results && results.kind !== 'point' && (
              <>
                <span className={styles.progress}>
                  <span style={{ width: `${(results.done / results.total) * 100}%` }} />
                </span>
                <span>{results.done} of {results.total} layers</span>
              </>
            )}
          </div>
        ) : feature.inspectorOpen && (
          <LayerList groups={groups} results={results} sparkScale={sparkScale} chartControl={chartControl} />
        )}
      </div>
    </DraggableBoxContentContainer>
  );
};
