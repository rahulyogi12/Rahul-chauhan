
export interface Reminder {
  id: string;
  task: string;
  time: string;
  completed: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'action' | 'error' | 'system';
}

export enum AppState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export enum ViewMode {
  LIVE = 'LIVE',
  TERMINAL = 'TERMINAL',
  CREATION = 'CREATION',
  ANALYSIS = 'ANALYSIS'
}

export interface Contact {
  name: string;
  number: string;
}

export interface PhoneState {
  isInCall: boolean;
  activeContact: Contact | null;
  callDuration: number;
}

export interface SearchResult {
  title: string;
  url: string;
}

export interface WeatherState {
  location: string;
  temperature: string;
  condition: string;
  humidity?: string;
  wind?: string;
}

export interface SharedProps {
  isAGIMode: boolean;
}

// Mock contacts for simulation
export const MOCK_CONTACTS: Contact[] = [
  { name: 'Mom', number: '9876543210' },
  { name: 'Dad', number: '9123456789' },
  { name: 'Boss', number: '8888888888' },
  { name: 'Pepper', number: '7777777777' },
  { name: 'Happy', number: '9999999999' }
];