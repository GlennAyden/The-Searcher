/**
 * Alpha Hunter Feature Module
 * 
 * Multi-stage investigation workflow for detecting smart money accumulation patterns.
 * 
 * Components:
 * - AlphaHunterContent: Main layout component
 * - WatchlistSidebar: Investigation list
 * - InvestigationHeader: Dynamic header
 * - AnomalyScanTable: Signal scanner
 * - Stage1Summary, Stage2VPACard, Stage3FlowCard, Stage4SupplyCard
 * 
 * State:
 * - AlphaHunterProvider/useAlphaHunter: Context and hook for investigation state
 */

// State management
export { AlphaHunterProvider, useAlphaHunter, AlphaHunterContext } from './state/AlphaHunterContext';

// Types
export * from './types';

// Main components
export { AlphaHunterContent } from './components/AlphaHunterContent';
export { default as WatchlistSidebar } from './components/WatchlistSidebar';
export { default as InvestigationHeader } from './components/InvestigationHeader';
export { default as AnomalyScanTable } from './components/AnomalyScanTable';

// Stage components
export { default as Stage1Summary } from './components/stages/Stage1Summary';
export { default as Stage2VPACard } from './components/stages/Stage2VPACard';
export { default as Stage2VisualizationPanel } from './components/stages/Stage2VisualizationPanel';
export { default as Stage3FlowCard } from './components/stages/Stage3FlowCard';
export { default as Stage4SupplyCard } from './components/stages/Stage4SupplyCard';
export { default as StageCard } from './components/stages/StageCard';
