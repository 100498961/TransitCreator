
import React from 'react';
import { Station, Line, StationType } from '../types';
import { STATION_TYPE_LABELS, INITIAL_COLORS } from '../constants';
import { Map as MapIcon, Route, Shuffle } from 'lucide-react';

interface PropertyPanelProps {
  selectedStation: Station | undefined;
  selectedLine: Line | undefined;
  onUpdateStation: (id: string, updates: Partial<Station>) => void;
  onUpdateLine: (id: string, updates: Partial<Line>) => void;
  onExtendLine?: (id: string) => void;
  onHistorySave: () => void;
  stations: Station[];
  lines: Line[];
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedStation,
  selectedLine,
  onUpdateStation,
  onUpdateLine,
  onExtendLine,
  onHistorySave,
  stations,
  lines,
}) => {
  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-y-auto">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
           <MapIcon size={18} className="text-blue-500" />
           Map Properties
        </h2>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Selection Editor */}
        {selectedStation && (
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">Station</h3>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedStation.name}
                  onFocus={onHistorySave}
                  onChange={(e) => onUpdateStation(selectedStation.id, { name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={selectedStation.type}
                onClick={onHistorySave}
                onChange={(e) => onUpdateStation(selectedStation.id, { type: e.target.value as StationType })}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {Object.entries(STATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            
            <div className="text-xs text-slate-500 italic border-t border-slate-700 pt-2">
              Tip: Drag the blue dot near the station name to move the label.
            </div>
          </div>
        )}

        {selectedLine && (
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">Line</h3>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={selectedLine.name}
                onFocus={onHistorySave}
                onChange={(e) => onUpdateLine(selectedLine.id, { name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Color</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {INITIAL_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                        onHistorySave();
                        onUpdateLine(selectedLine.id, { color });
                    }}
                    className={`w-6 h-6 rounded-full border-2 ${selectedLine.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input 
                  type="color" 
                  value={selectedLine.color}
                  onClick={onHistorySave}
                  onChange={(e) => onUpdateLine(selectedLine.id, { color: e.target.value })}
                  className="w-6 h-6 rounded-full overflow-hidden p-0 border-0"
                />
              </div>
            </div>

             <div>
              <label className="block text-xs text-slate-400 mb-1">Width: {selectedLine.width}px</label>
              <input
                type="range"
                min="2"
                max="20"
                value={selectedLine.width}
                onMouseDown={onHistorySave}
                onChange={(e) => onUpdateLine(selectedLine.id, { width: parseInt(e.target.value) })}
                className="w-full accent-blue-500 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="space-y-2 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="loopLine"
                      checked={selectedLine.closedLoop || false}
                      onClick={onHistorySave}
                      onChange={(e) => onUpdateLine(selectedLine.id, { closedLoop: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="loopLine" className="text-sm text-slate-300">Closed Loop</label>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="alternateRoute"
                      checked={selectedLine.alternateRoute || false}
                      onClick={onHistorySave}
                      onChange={(e) => onUpdateLine(selectedLine.id, { alternateRoute: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="alternateRoute" className="text-sm text-slate-300 flex items-center gap-2">
                        <Shuffle size={14} /> Flip Route Angle
                    </label>
                </div>
            </div>

            {onExtendLine && (
                <div className="pt-2 border-t border-slate-700">
                    <button
                        onClick={() => onExtendLine(selectedLine.id)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-lg"
                    >
                        <Route size={16} /> Continue Line
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2 text-center">Click stations to append to this line</p>
                </div>
            )}
          </div>
        )}

        {!selectedStation && !selectedLine && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 space-y-2">
                <div className="p-3 bg-slate-800 rounded-full">
                    <MapIcon size={24} className="opacity-50"/>
                </div>
                <p className="text-sm">Select an element to edit properties</p>
            </div>
        )}

        {/* Stats */}
        <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          <p>Stats:</p>
          <ul className="list-disc pl-4 mt-1 space-y-1">
            <li>Stations: {stations.length}</li>
            <li>Lines: {lines.length}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
