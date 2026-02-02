
import { StationType } from './types';

export const GRID_SIZE = 20;
export const DEFAULT_STATION_RADIUS = 8;
export const INTERCHANGE_RADIUS = 12;
export const WAYPOINT_RADIUS = 4;

export const DEFAULT_LINE_WIDTH = 6;
export const LINE_SPACING = 7; // Distance between parallel line centers

export const DEFAULT_LABEL_OFFSET = { x: 15, y: -15 };
export const MAX_LABEL_DISTANCE = 80;

export const STATION_TYPE_LABELS: Record<StationType, string> = {
  [StationType.Circle]: 'Standard (Circle)',
  [StationType.Square]: 'Terminal (Square)',
  [StationType.Interchange]: 'Interchange (Ring)',
  [StationType.Waypoint]: 'Waypoint (Joint)',
};

export const INITIAL_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

export const INITIAL_STATIONS_MOCK = [
  { id: 's1', name: 'Central Plaza', x: 400, y: 300, type: StationType.Interchange },
  { id: 's2', name: 'North Gate', x: 400, y: 100, type: StationType.Circle },
  { id: 's3', name: 'West End', x: 200, y: 300, type: StationType.Square },
  { id: 's4', name: 'East Harbor', x: 600, y: 300, type: StationType.Square },
];

export const INITIAL_LINES_MOCK = [
  { 
    id: 'l1', 
    name: 'Blue Line', 
    color: '#3b82f6', 
    width: 6, 
    stationIds: ['s3', 's1', 's4'] 
  },
  {
    id: 'l2',
    name: 'Red Line',
    color: '#ef4444',
    width: 6, 
    stationIds: ['s2', 's1']
  }
];
