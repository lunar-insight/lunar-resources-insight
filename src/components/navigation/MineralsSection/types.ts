import { Selection } from 'react-aria-components';

export type DataAvailability = 'map+ground' | 'ground';

export type MineralCategory = 'silicate' | 'oxide' | 'moon-discovered';

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
}

export interface Rock {
  id: string;
  name: string;
  icon: string;
  location: string;
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
