export type TerminalMobileTab = 'warroom' | 'chart' | 'intel';
export type TerminalActiveTab = 'intel' | 'community' | 'positions';
export type TerminalInnerTab = 'chat' | 'headlines' | 'events' | 'flow';
export type PassportActiveTab = 'profile' | 'wallet' | 'positions' | 'arena';
export type OraclePeriod = '7d' | '30d' | 'all';
export type OracleSort = 'accuracy' | 'level' | 'sample' | 'conf';

export interface UserPreferences {
  userId: string;
  defaultPair: string;
  defaultTimeframe: string;
  battleSpeed: number;
  signalsEnabled: boolean;
  sfxEnabled: boolean;
  chartTheme: string;
  dataSource: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

export interface UpdatePreferencesRequest {
  defaultPair?: string;
  defaultTimeframe?: string;
  battleSpeed?: number;
  signalsEnabled?: boolean;
  sfxEnabled?: boolean;
  chartTheme?: string;
  dataSource?: string;
  language?: string;
}

export interface UserUiState {
  userId: string;
  terminalLeftWidth: number;
  terminalRightWidth: number;
  terminalLeftCollapsed: boolean;
  terminalRightCollapsed: boolean;
  terminalMobileTab: TerminalMobileTab;
  terminalActiveTab: TerminalActiveTab;
  terminalInnerTab: TerminalInnerTab;
  passportActiveTab: PassportActiveTab;
  signalsFilter: string;
  oraclePeriod: OraclePeriod;
  oracleSort: OracleSort;
  createdAt: number;
  updatedAt: number;
}

export interface UpdateUiStateRequest {
  terminalLeftWidth?: number;
  terminalRightWidth?: number;
  terminalLeftCollapsed?: boolean;
  terminalRightCollapsed?: boolean;
  terminalMobileTab?: TerminalMobileTab;
  terminalActiveTab?: TerminalActiveTab;
  terminalInnerTab?: TerminalInnerTab;
  passportActiveTab?: PassportActiveTab;
  signalsFilter?: string;
  oraclePeriod?: OraclePeriod;
  oracleSort?: OracleSort;
}
