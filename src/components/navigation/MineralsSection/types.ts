import { Selection } from 'react-aria-components';
import { DataAvailability } from 'types/dataSource';

export type MineralCategory = 'silicate' | 'oxide' | 'moon-discovered';

export type MineralGrouping = 'group' | 'individual';

export interface DiscoveryInfo {
  mission?: string;
  year?: number;
  location?: string;
}

export interface Mineral {
  id: string;
  name: string;
  formula: string;
  category: MineralCategory;
  dataType: DataAvailability;
  discoveryInfo?: DiscoveryInfo;
  mineralType?: 'silicate' | 'oxide' | 'phosphate'; // For moon-discovered minerals
  grouping?: MineralGrouping; // Distinguishes mineral groups from individual species
}

export interface Rock {
  id: string;
  name: string;
  icon: string;
  rockType: string;
  composition: string[]; // array of mineral IDs
  dataType: DataAvailability;
  description?: string;
}

export interface RockGridProps {
  rocks: Rock[];
  selectedRocks: Selection;
  onSelectionChange: (selected: Selection) => void;
  highlightedRocks: Set<string>;
  onRockHover: (rockId: string | null) => void;
}

export interface MineralGridProps {
  minerals: Mineral[];
  selectedMinerals: Selection;
  onSelectionChange: (selected: Selection) => void;
  highlightedMinerals: Set<string>;
  onMineralHover: (mineralId: string | null) => void;
}
