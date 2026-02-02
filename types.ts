
export type Point = {
  x: number;
  y: number;
};

export enum StationType {
  Circle = 'CIRCLE',
  Square = 'SQUARE',
  Interchange = 'INTERCHANGE',
  Waypoint = 'WAYPOINT', // Invisible joint
}

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  type: StationType;
  selected?: boolean;
  labelOffset?: Point; // Relative to x, y
}

export interface Line {
  id: string;
  name: string;
  color: string;
  width: number;
  stationIds: string[]; // Ordered list of station IDs
  closedLoop?: boolean;
  alternateRoute?: boolean; // Flips the elbow direction of the line
}

export enum ToolMode {
  Select = 'SELECT',
  AddStation = 'ADD_STATION',
  AddLine = 'ADD_LINE',
  Delete = 'DELETE',
}

export interface AppState {
  stations: Station[];
  lines: Line[];
  zoom: number;
  pan: Point;
  activeTool: ToolMode;
  selectedStationId: string | null;
  selectedLineId: string | null;
  activeLineId: string | null; // For currently drawing a line
}

export interface ThemeSuggestion {
  name: string;
  description: string;
  lineColors: string[];
  stationNames: string[];
}
