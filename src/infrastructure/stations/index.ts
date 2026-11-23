import type { StationRunner } from '../../domain/types.js';
import { AccessibilityUiStation } from './AccessibilityUiStation.js';
import { CodeHealthObservabilityStation } from './CodeHealthObservabilityStation.js';
import { E2eBrowserStation } from './E2eBrowserStation.js';
import { SecurityCvesStation } from './SecurityCvesStation.js';
import { StaticTypesStation } from './StaticTypesStation.js';
import { SyntaxConfigStation } from './SyntaxConfigStation.js';
import { TestsCoverageStation } from './TestsCoverageStation.js';

export function createDefaultStations(): readonly StationRunner[] {
  return [
    new SyntaxConfigStation(),
    new StaticTypesStation(),
    new TestsCoverageStation(),
    new SecurityCvesStation(),
    new E2eBrowserStation(),
    new AccessibilityUiStation(),
    new CodeHealthObservabilityStation()
  ];
}
