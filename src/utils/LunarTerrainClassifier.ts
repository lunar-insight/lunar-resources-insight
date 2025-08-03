// Based on Ca/(Fe + 2*Ti) ratio

import { layersConfig } from '../geoConfigExporter';

export interface TerrainClassification {
  type: 'highlands' | 'mare' | 'transitional';
  confidence: 'high' | 'medium' | 'low';
  description: string;
  ratio: number;
}

export class LunarTerrainClassifier {
  private static classificationCache = new Map<string, TerrainClassification>();
  private static readonly MAX_CACHE_SIZE = 500;

  /**
   * Classify lunar terrain based on Ca/(Fe + 2*Ti) ratio
   * Simple distinction between anorthosite highlands and mare basalts
   * before having a more complex formula in the future
   */
  static classifyTerrain(calcium: number, iron: number, titanium: number): TerrainClassification {
    // Cache optimization for performance
    const cacheKey = `${calcium.toFixed(2)}_${iron.toFixed(2)}_${titanium.toFixed(2)}`;

    if (this.classificationCache.has(cacheKey)) {
      return this.classificationCache.get(cacheKey)!;
    }

    const ratio = calcium / (iron + 2 * titanium);
    let classification: TerrainClassification;

    // Classification based on established lunar geochemistry
    if (ratio > 1.5) {
      classification = {
        type: 'highlands',
        confidence: 'high',
        description: 'Typical anorthosite hightlands',
        ratio
      };
    } else if (ratio > 1.0) {
      classification = {
        type: 'highlands',
        confidence: 'medium',
        description: 'Probable highlands',
        ratio
      };
    } else if (ratio < 0.6) {
      classification = {
        type: 'mare',
        confidence: 'high',
        description: 'Typical mare basalt',
        ratio
      };
    } else if (ratio < 0.8) {
      classification = {
        type: 'mare',
        confidence: 'medium',
        description: 'Probable mare',
        ratio
      };
    } else {
      classification = {
        type: 'transitional',
        confidence: 'low',
        description: 'Transitional zone or ejecta',
        ratio
      };
    }

    // Cache management
    if (this.classificationCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.classificationCache.keys().next().value;
      this.classificationCache.delete(firstKey);
    }

    this.classificationCache.set(cacheKey, classification);
    return classification;
  }

  /**
   * Extract Ca, Fe, Ti values dynamically based on layersConfig
   */
  static extractElements(values: Record<string, number>): { calcium: number; iron: number; titanium: number } | null {
    const requiredElements = ['calcium', 'iron', 'titanium'];
    const extractedElements: Record<string, number> = {};

    for (const elementName of requiredElements) {
      const value = this.findElementValue(values, elementName);
      if (value !== undefined) {
        extractedElements[elementName] = value;
      }
    }

    if (requiredElements.every(element => extractedElements[element] !== undefined)) {
      return {
        calcium: extractedElements.calcium,
        iron: extractedElements.iron,
        titanium: extractedElements.titanium
      };
    }

    return null;
  }

  /**
   * Find element value dynamically using layersConfig
   */
  private static findElementValue(values: Record<string, number>, targetElement: string): number | undefined {
    for (const [layerId, config] of Object.entries(layersConfig.layers)) {
      if (config.category === 'chemical' &&
          config.element?.toLowerCase() === targetElement.toLowerCase() &&
          values[layerId] !== undefined) {
        return values[layerId];
      }
    }

    return undefined;
  }

  /**
   * Check if we can classify based on available elements in values and config
   * TODO possibly check at start instead for performance
   */
  static canClassify(values: Record<string, number>): boolean {
    const requiredElements = ['calcium', 'iron', 'titanium'];

    return requiredElements.every(element =>
      this.findElementValue(values, element) !== undefined
    );
  }
}