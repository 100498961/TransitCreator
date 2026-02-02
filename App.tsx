import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { MapCanvas } from './components/MapCanvas';
import { 
  Station, 
  Line, 
  ToolMode, 
  StationType, 
  Point
} from './types';
import { INITIAL_COLORS, GRID_SIZE } from './constants';
import { Download, Info, ArrowLeft, Undo2, Redo2, FileJson, Image as ImageIcon } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [stations, setStations] = useState<Station[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeTool, setActiveTool] = useState<ToolMode>(ToolMode.Select);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [activeLineBuilderId, setActiveLineBuilderId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // References
  const mapRef = useRef<SVGSVGElement>(null);

  // History State
  const [history, setHistory] = useState<{stations: Station[], lines: Line[]}[]>([]);
  const [future, setFuture] = useState<{stations: Station[], lines: Line[]}[]>([]);

  // Derived
  const selectedStation = stations.find(s => s.id === selectedStationId);
  const selectedLine = lines.find(l => l.id === selectedLineId);

  // History Management
  const saveHistory = useCallback(() => {
    setHistory(prev => {
        // Debounce exact duplicate states (e.g. clicking without moving)
        const last = prev[prev.length - 1];
        if (last && 
            JSON.stringify(last.stations) === JSON.stringify(stations) && 
            JSON.stringify(last.lines) === JSON.stringify(lines)) {
            return prev;
        }
        return [...prev, { stations, lines }];
    });
    setFuture([]);
  }, [stations, lines]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    // Save current state to future
    setFuture(prev => [{ stations, lines }, ...prev]);
    
    // Restore previous
    setStations(previous.stations);
    setLines(previous.lines);
    setHistory(newHistory);
    
    // Clear selection if item no longer exists (optional safety)
    if (selectedStationId && !previous.stations.find(s => s.id === selectedStationId)) setSelectedStationId(null);
    if (selectedLineId && !previous.lines.find(l => l.id === selectedLineId)) setSelectedLineId(null);
  }, [history, stations, lines, selectedStationId, selectedLineId]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    // Save current to history
    setHistory(prev => [...prev, { stations, lines }]);

    // Restore next
    setStations(next.stations);
    setLines(next.lines);
    setFuture(newFuture);
  }, [future, stations, lines]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Undo: Ctrl+Z
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Actions
  const handleAddStation = (point: Point) => {
    const newStation: Station = {
      id: uuidv4(),
      name: `Station ${stations.length + 1}`,
      x: point.x,
      y: point.y,
      type: StationType.Circle,
    };
    setStations([...stations, newStation]);
    setSelectedStationId(newStation.id);
  };

  const handleUpdateStation = (id: string, updates: Partial<Station>) => {
    setStations(stations.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleUpdateLine = (id: string, updates: Partial<Line>) => {
    setLines(lines.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleDelete = (type: 'station' | 'line', id: string) => {
    if (type === 'station') {
      setStations(stations.filter(s => s.id !== id));
      setLines(lines.map(l => ({
        ...l,
        stationIds: l.stationIds.filter(sid => sid !== id)
      })).filter(l => l.stationIds.length > 0)); 
      if (selectedStationId === id) setSelectedStationId(null);
    } else {
      setLines(lines.filter(l => l.id !== id));
      if (selectedLineId === id) setSelectedLineId(null);
    }
  };

  const handleStationMove = (id: string, point: Point) => {
    setStations(stations.map(s => s.id === id ? { ...s, ...point } : s));
  };

  const handleStationLabelMove = (id: string, offset: Point) => {
      setStations(stations.map(s => s.id === id ? { ...s, labelOffset: offset } : s));
  };

  const handleLineAdd = (stationId: string) => {
    if (!activeLineBuilderId) {
      const newLine: Line = {
        id: uuidv4(),
        name: `Line ${lines.length + 1}`,
        color: INITIAL_COLORS[lines.length % INITIAL_COLORS.length],
        width: 6,
        stationIds: [stationId],
      };
      setLines([...lines, newLine]);
      setActiveLineBuilderId(newLine.id);
      setSelectedLineId(newLine.id);
    } else {
      const activeLine = lines.find(l => l.id === activeLineBuilderId);
      if (activeLine) {
        if (activeLine.stationIds[activeLine.stationIds.length - 1] !== stationId) {
           handleUpdateLine(activeLineBuilderId, {
             stationIds: [...activeLine.stationIds, stationId]
           });
        }
      }
    }
  };

  const stopLineBuilding = () => {
    setActiveLineBuilderId(null);
    if (activeTool === ToolMode.AddLine) {
        setActiveTool(ToolMode.Select);
    }
  };

  const handleExtendLine = (lineId: string) => {
      saveHistory(); // Save state before modifying
      setActiveLineBuilderId(lineId);
      setActiveTool(ToolMode.AddLine);
      setSelectedLineId(lineId);
  };

  const handleExportJson = () => {
    const data = {
        stations,
        lines,
        metadata: {
            exportedAt: new Date().toISOString(),
            app: "TransitCreator"
        }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metro-map.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setIsExportMenuOpen(false);
  };

  const handleExportPng = () => {
    if (!mapRef.current) return;
    const svgElement = mapRef.current;
    
    // 1. Calculate Content Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (stations.length === 0) {
        // Fallback defaults if empty
        minX = 0; minY = 0; maxX = 800; maxY = 600;
    } else {
        stations.forEach(s => {
            if (s.x < minX) minX = s.x;
            if (s.x > maxX) maxX = s.x;
            if (s.y < minY) minY = s.y;
            if (s.y > maxY) maxY = s.y;
        });
    }
    const padding = 60;
    const x = minX - padding;
    const y = minY - padding;
    const width = (maxX - minX) + padding * 2;
    const height = (maxY - minY) + padding * 2;

    // 2. Clone the SVG
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    
    // 3. Clean up the clone
    // Remove the huge grid background rect (it's the first rect in the first g usually, or check by attribute)
    const cloneGridRect = clone.querySelector('rect[width="100000"]');
    if (cloneGridRect) cloneGridRect.remove();

    // Reset transform on the content group in the clone
    const cloneContentGroup = clone.querySelector('g');
    if (cloneContentGroup) {
        cloneContentGroup.setAttribute('transform', '');
    }
    
    // 4. Set viewBox to the bounding box
    clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    clone.setAttribute('width', `${width}`);
    clone.setAttribute('height', `${height}`);
    
    // 5. REMOVED background rect insertion to allow transparency
    
    // 6. Serialize
    const svgData = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    // Handle special chars/encoding
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    
    img.onload = () => {
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL("image/png");
            
            const a = document.createElement('a');
            a.download = 'transit-map.png';
            a.href = pngFile;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };
    setIsExportMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar / Properties */}
      <PropertyPanel
        selectedStation={selectedStation}
        selectedLine={selectedLine}
        onUpdateStation={handleUpdateStation}
        onUpdateLine={handleUpdateLine}
        onExtendLine={handleExtendLine}
        onHistorySave={saveHistory}
        stations={stations}
        lines={lines}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Top Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-lg border border-slate-700 shadow-xl pointer-events-auto flex items-center gap-3">
             <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">Transit<span className="text-blue-500">Creator</span></h1>
                <p className="text-[10px] text-slate-400 mt-1">Professional Schematic Editor</p>
             </div>
             
             <div className="w-px h-8 bg-slate-700 mx-2"></div>
             
             <button 
                onClick={undo} 
                disabled={history.length === 0}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                title="Undo (Ctrl+Z)"
             >
                <Undo2 size={18} />
             </button>
             <button 
                onClick={redo} 
                disabled={future.length === 0}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                title="Redo (Ctrl+Shift+Z)"
             >
                <Redo2 size={18} />
             </button>
          </div>

          <div className="flex gap-2 pointer-events-auto">
             {activeLineBuilderId && (
                 <button 
                    className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg animate-pulse flex items-center gap-2 transition-colors"
                    onClick={stopLineBuilding}
                 >
                    <ArrowLeft size={16} /> Finish Line
                 </button>
             )}
             
             <div className="relative">
                 <button 
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                    className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-600 shadow-lg flex items-center gap-2 text-sm font-medium transition-colors"
                 >
                    <Download size={16} /> Export
                 </button>
                 
                 {isExportMenuOpen && (
                     <div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-20 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                         <button onClick={handleExportJson} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-700 text-sm text-left">
                            <FileJson size={14} className="text-blue-400"/> JSON
                         </button>
                         <div className="h-px bg-slate-700"></div>
                         <button onClick={handleExportPng} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-700 text-sm text-left">
                            <ImageIcon size={14} className="text-green-400"/> PNG Image
                         </button>
                     </div>
                 )}
                 {/* Click outside closer would be ideal but skipped for brevity */}
             </div>
          </div>
        </div>

        {/* Floating Toolbar */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <Toolbar activeTool={activeTool} setTool={(t) => {
                setActiveTool(t);
                if (t !== ToolMode.AddLine) setActiveLineBuilderId(null);
            }} />
        </div>

        {/* Canvas */}
        <MapCanvas
          ref={mapRef}
          stations={stations}
          lines={lines}
          activeTool={activeTool}
          selectedStationId={selectedStationId}
          selectedLineId={selectedLineId}
          onStationAdd={handleAddStation}
          onStationSelect={(id) => {
             setSelectedStationId(id);
             setSelectedLineId(null);
          }}
          onStationMove={handleStationMove}
          onStationLabelMove={handleStationLabelMove}
          onLineAdd={handleLineAdd}
          onLineSelect={(id) => {
              setSelectedLineId(id);
              setSelectedStationId(null);
          }}
          onDelete={handleDelete}
          onHistorySave={saveHistory}
        />

        {/* Instructions Overlay */}
        <div className="absolute bottom-4 right-4 max-w-xs text-right pointer-events-none opacity-60 hover:opacity-100 transition-opacity">
            <div className="bg-slate-900/80 p-3 rounded border border-slate-800 text-xs text-slate-400">
                <p className="font-bold text-slate-300 mb-1 flex items-center justify-end gap-1"><Info size={12}/> Controls</p>
                <div className="space-y-1">
                    <p><b>Select Mode:</b> Drag stations. Click background to deselect.</p>
                    <p><b>Station Mode:</b> Click anywhere to add station.</p>
                    <p><b>Line Mode:</b> Click stations in order to connect.</p>
                    <p><b>Labels:</b> Select a station, then drag its text label to move it.</p>
                    <p className="text-slate-500 italic">Zoom/Pan only available in Select Mode.</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;