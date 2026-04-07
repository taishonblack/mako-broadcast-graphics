export type PollState = 'draft' | 'ready' | 'live' | 'closed' | 'archived';
export type OutputState = 'standby' | 'previewing' | 'live_output' | 'disconnected';
export type TemplateName = 'horizontal-bar' | 'vertical-bar' | 'pie-donut' | 'progress-bar' | 'puck-slider' | 'fullscreen-hero' | 'lower-third';
export type BackgroundFit = 'cover' | 'contain' | 'stretch';
export type BackgroundPosition = 'center' | 'top' | 'bottom';
export type ValueDisplay = 'percent' | 'votes' | 'both';

export interface PollOption {
  id: string;
  text: string;
  shortLabel?: string;
  votes: number;
  order: number;
}

export interface Poll {
  id: string;
  internalName: string;
  question: string;
  subheadline?: string;
  slug: string;
  state: PollState;
  options: PollOption[];
  totalVotes: number;
  votesPerSecond: number;
  template: TemplateName;
  themeId: string;
  showLiveResults: boolean;
  hideUntilClose: boolean;
  minVoteThreshold: number;
  allowVoteChange: boolean;
  autoCloseDuration?: number;
  showThankYou: boolean;
  showFinalResults: boolean;
  createdAt: string;
  openedAt?: string;
  closedAt?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  backgroundImageUrl?: string;
  backgroundFit: BackgroundFit;
  backgroundPosition: BackgroundPosition;
  overlayOpacity: number;
  blurAmount: number;
  tintColor: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  panelFill: string;
  panelBorder: string;
  chartColorA: string;
  chartColorB: string;
  chartColorC: string;
  chartColorD: string;
  qrFrameColor: string;
  bubbleFill: string;
  bubbleBorder: string;
  smoothing: boolean;
  transitionSpeed: number;
  countUpNumbers: boolean;
}

export interface RecentPoll {
  id: string;
  name: string;
  date: string;
  template: TemplateName;
  totalVotes: number;
  state: PollState;
}
