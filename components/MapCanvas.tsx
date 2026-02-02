
import React, { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Station, Line, Point, ToolMode, StationType } from '../types';
import { GRID_SIZE, DEFAULT_STATION_RADIUS, INTERCHANGE_RADIUS, WAYPOINT_RADIUS, LINE_SPACING, DEFAULT_LABEL_OFFSET, MAX_LABEL_DISTANCE } from '../constants';
import * as d3 from 'd3';

interface MapCanvasProps {
  stations: Station[];
  lines: Line[];
  activeTool: ToolMode;
  selectedStationId: string | null;
  selectedLineId: string | null;
  onStationAdd: (point: Point) => void;
  onStationSelect: (id: string | null) => void;
  onStationMove: (id: string, point: Point) => void;
  onStationLabelMove: (id: string, offset: Point) => void;
  onLineAdd: (stationId: string) => void;
  onLineSelect: (id: string | null) => void;
  onDelete: (type: 'station' | 'line', id: string) => void;
  onHistorySave: () => void;
}

// --- Geometry Helpers ---
const getDir = (p1: Point, p2: Point) => {
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return d < 0.001 ? { x: 0, y: 0 } : { x: (p2.x - p1.x) / d, y: (p2.y - p1.y) / d };
};

const getNormal = (v: { x: number, y: number }) => ({ x: -v.y, y: v.x });

const pointKey = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;

// Get intersection of two infinite lines defined by (p, dir)
const getLineIntersection = (p1: Point, d1: Point, p2: Point, d2: Point): Point => {
  const det = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(det) < 0.0001) return p1; // Parallel, fallback
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / det;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
};

export const MapCanvas = forwardRef<SVGSVGElement, MapCanvasProps>(({
  stations,
  lines,
  activeTool,
  selectedStationId,
  selectedLineId,
  onStationAdd,
  onStationSelect,
  onStationMove,
  onStationLabelMove,
  onLineAdd,
  onLineSelect,
  onDelete,
  onHistorySave
}, ref) => {
  const localSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  
  // Expose local ref to parent via forwarded ref
  useImperativeHandle(ref, () => localSvgRef.current!);
  
  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'STATION' | 'LABEL';
    stationId: string;
    startPoint: Point; // Screen coordinates of mouse start
    originalPos: Point; // Original Station Pos OR Label Offset
  } | null>(null);

  // --- Core Octolinear Logic ---
  const getOctolinearSegment = (p1: Point, p2: Point, alternate: boolean = false): Point[] => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Straight lines or 45-degree lines don't need elbows
    if (adx < 1 || ady < 1 || Math.abs(adx - ady) < 1) {
      return [p1, p2];
    }

    const candidates: { points: Point[], len: number, horizontalFirst: boolean }[] = [];
    const tryPath = (mid: Point, horizontalFirst: boolean) => {
        const len = Math.hypot(mid.x - p1.x, mid.y - p1.y) + Math.hypot(p2.x - mid.x, p2.y - mid.y);
        candidates.push({ points: [p1, mid, p2], len, horizontalFirst });
    };

    // Calculate possible midpoints for L-shapes (or Z-shapes but we stick to L-shapes for 2 points)
    // Option 1: Horizontal then Vertical (moves x first, then y)
    // midpoint = (p2.x, p1.y) or (p1.x, p2.y)
    
    // For octolinear, we have 45 degree segments.
    // Case 1: 45 then Straight
    // Case 2: Straight then 45
    
    // Let's generate the 4 standard octolinear candidates
    // 1. Vertical -> Diagonal
    const mx1 = p2.x - Math.sign(dx) * ady; // this math is for diagonal
    const mx2 = p2.x + Math.sign(dx) * ady; 
    
    // Instead of complex math, let's just consider the two main "L" shapes for schematic maps
    // 1. Move Horizontal to align X, then Vertical (or diagonal if enforced)
    // 2. Move Vertical to align Y, then Horizontal
    
    // Standard Octolinear construction:
    // We want to find a midpoint M such that P1->M is orthogonal/diagonal and M->P2 is orthogonal/diagonal
    
    // Candidate A: Horizontal first (y constant) until 45-deg intercept?
    // Let's stick to the previous robust finder but use 'alternate' to pick reverse order
    
    const tryCandidates = () => {
        // Horizontal diff vs Vertical diff
        // We have 4 geometric solutions for strict octolinear path between 2 points using max 2 segments
        
        // 1. Start Horizontal, then Diagonal
        // Intersection of y=p1.y and diagonal from p2
        // y - p2.y = (x - p2.x)  OR y - p2.y = -(x - p2.x)
        // p1.y - p2.y = x - p2.x => x = p2.x + (p1.y - p2.y)
        const x1 = p2.x + (p1.y - p2.y); // diag 1
        const x2 = p2.x - (p1.y - p2.y); // diag 2
        
        // We check which x is "between" p1.x and p2.x or valid
        tryPath({ x: x1, y: p1.y }, true);
        tryPath({ x: x2, y: p1.y }, true);

        // 2. Start Vertical, then Diagonal
        // Intersection of x=p1.x and diagonal from p2
        // y - p2.y = (p1.x - p2.x)
        const y1 = p2.y + (p1.x - p2.x);
        const y2 = p2.y - (p1.x - p2.x);
        tryPath({ x: p1.x, y: y1 }, false);
        tryPath({ x: p1.x, y: y2 }, false);
        
        // 3. Start Diagonal, then Horizontal
        // Intersection of y=p2.y and diagonal from p1
        const x3 = p1.x + (p2.y - p1.y);
        const x4 = p1.x - (p2.y - p1.y);
        tryPath({ x: x3, y: p2.y }, false); // ends horizontal, effectively "vertical first" in general shape
        tryPath({ x: x4, y: p2.y }, false);

        // 4. Start Diagonal, then Vertical
        // Intersection of x=p2.x and diagonal from p1
        const y3 = p1.y + (p2.x - p1.x);
        const y4 = p1.y - (p2.x - p1.x);
        tryPath({ x: p2.x, y: y3 }, true); // ends vertical, effectively "horizontal first" logic
        tryPath({ x: p2.x, y: y4 }, true);
    };
    
    tryCandidates();

    // Filter valid points that are roughly within bounding box (minimize huge loops)
    const valid = candidates.filter(c => {
       // Check if mid point is somewhat between start and end (allow some overshoot for 45 deg)
       // Simple heuristic: length shouldn't be insanely larger than direct distance
       const direct = Math.hypot(dx, dy);
       return c.len < direct * 1.5; 
    });

    if (valid.length === 0) return [p1, p2];

    // Sort by length first
    valid.sort((a, b) => a.len - b.len);
    
    // Group by length (roughly equal)
    const shortestLen = valid[0].len;
    const bestCandidates = valid.filter(c => Math.abs(c.len - shortestLen) < 1);
    
    // Here is where we apply "Alternate Route"
    // Usually there are 2 best candidates (symmetric).
    // We sort them based on the 'alternate' flag.
    
    bestCandidates.sort((a, b) => {
        // If alternate is false, prefer one type (e.g. horizontal first)
        // If alternate is true, prefer the other
        if (a.horizontalFirst === b.horizontalFirst) return 0;
        if (alternate) {
            return a.horizontalFirst ? 1 : -1;
        } else {
            return a.horizontalFirst ? -1 : 1;
        }
    });

    return bestCandidates[0].points;
  };

  // --- Precompute Segment Usage for Parallel Offsets ---
  // Returns a map where key is segment ID and value is sorted list of line IDs on that segment
  const segmentRegistry = useMemo(() => {
    const registry = new Map<string, string[]>();
    
    // Helper to add line to segment
    const register = (pA: Point, pB: Point, lineId: string) => {
        if (Math.hypot(pA.x - pB.x, pA.y - pB.y) < 1) return;
        // Normalize key (sort points)
        const kA = pointKey(pA);
        const kB = pointKey(pB);
        const key = kA < kB ? `${kA}_${kB}` : `${kB}_${kA}`;
        
        if (!registry.has(key)) registry.set(key, []);
        const list = registry.get(key)!;
        if (!list.includes(lineId)) list.push(lineId);
    };

    lines.forEach(line => {
        if (line.stationIds.length < 2) return;
        
        const stationCoords = line.stationIds.map(id => stations.find(s => s.id === id)).filter(Boolean) as Station[];
        if (stationCoords.length < 2) return;

        // Iterate through station connections
        for (let i = 0; i < stationCoords.length - 1; i++) {
            const pts = getOctolinearSegment(stationCoords[i], stationCoords[i+1], line.alternateRoute);
            for (let j = 0; j < pts.length - 1; j++) {
                register(pts[j], pts[j+1], line.id);
            }
        }
        if (line.closedLoop) {
             const pts = getOctolinearSegment(stationCoords[stationCoords.length - 1], stationCoords[0], line.alternateRoute);
             for (let j = 0; j < pts.length - 1; j++) {
                register(pts[j], pts[j+1], line.id);
            }
        }
    });
    
    // Sort line IDs in registry to ensure consistent ordering (e.g. by ID)
    registry.forEach(list => list.sort());
    return registry;
  }, [lines, stations]);


  // --- Helper: Get Line Offset on a specific geometric segment ---
  const getLineOffset = (p1: Point, p2: Point, lineId: string): number => {
    const kA = pointKey(p1);
    const kB = pointKey(p2);
    const key = kA < kB ? `${kA}_${kB}` : `${kB}_${kA}`;
    
    const linesOnSeg = segmentRegistry.get(key);
    if (!linesOnSeg) return 0;

    const index = linesOnSeg.indexOf(lineId);
    if (index === -1) return 0;

    const count = linesOnSeg.length;
    // Centered offset: 
    // index 0 of 2 -> -0.5 * spacing
    // index 1 of 2 -> +0.5 * spacing
    return (index - (count - 1) / 2) * LINE_SPACING;
  };

  // --- Path Generation ---
  const generateSmoothPath = (points: Point[], cornerRadius: number): string => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len1 = Math.hypot(v1.x, v1.y);
        const len2 = Math.hypot(v2.x, v2.y);
        const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

        if (r < 1) {
            d += ` L ${p1.x} ${p1.y}`;
            continue;
        }

        const u1 = { x: v1.x / len1, y: v1.y / len1 };
        const u2 = { x: v2.x / len2, y: v2.y / len2 };
        const qStart = { x: p1.x - u1.x * r, y: p1.y - u1.y * r };
        const qEnd = { x: p1.x + u2.x * r, y: p1.y + u2.y * r };

        d += ` L ${qStart.x} ${qStart.y}`;
        d += ` Q ${p1.x} ${p1.y} ${qEnd.x} ${qEnd.y}`;
    }

    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  };

  const getLinePath = (line: Line) => {
    const coords = line.stationIds.map(id => stations.find(s => s.id === id)).filter(Boolean) as Station[];
    if (coords.length < 2) return '';

    // 1. Build raw geometric path (centerline)
    let rawPoints: Point[] = [coords[0]];
    for (let i = 0; i < coords.length - 1; i++) {
        const seg = getOctolinearSegment(coords[i], coords[i+1], line.alternateRoute);
        for (let j = 1; j < seg.length; j++) rawPoints.push(seg[j]);
    }
    if (line.closedLoop) {
        const seg = getOctolinearSegment(coords[coords.length-1], coords[0], line.alternateRoute);
        for (let j = 1; j < seg.length; j++) rawPoints.push(seg[j]);
        rawPoints.push(rawPoints[1]); // Wrap for corner calculation
    }

    // 2. Calculate offset path
    const offsetPoints: Point[] = [];
    
    // Process internal vertices
    const maxIdx = line.closedLoop ? rawPoints.length - 2 : rawPoints.length - 1;

    for (let i = 0; i <= maxIdx; i++) {
        let pCurr = rawPoints[i];
        
        // Incoming Segment info
        let dirIn = { x: 0, y: 0 };
        let offsetIn = 0;
        
        if (i > 0) {
            const pPrev = rawPoints[i-1];
            dirIn = getDir(pPrev, pCurr);
            offsetIn = getLineOffset(pPrev, pCurr, line.id);
        } else if (line.closedLoop) {
            // Use end of loop
            const pPrev = rawPoints[maxIdx]; // The one before wrap
            dirIn = getDir(pPrev, pCurr);
            offsetIn = getLineOffset(pPrev, pCurr, line.id);
        }

        // Outgoing Segment info
        let dirOut = { x: 0, y: 0 };
        let offsetOut = 0;

        if (i < rawPoints.length - 1) {
            const pNext = rawPoints[i+1];
            dirOut = getDir(pCurr, pNext);
            offsetOut = getLineOffset(pCurr, pNext, line.id);
        } else if (line.closedLoop) {
             // wrap to start
             const pNext = rawPoints[1]; // Since rawPoints[0] is same as rawPoints[maxIdx+1]
             dirOut = getDir(pCurr, pNext);
             offsetOut = getLineOffset(pCurr, pNext, line.id);
        }

        const normIn = getNormal(dirIn);
        const normOut = getNormal(dirOut);

        // Calculate shifted lines
        
        if (i === 0 && !line.closedLoop) {
            // Start of open line: shift perpendicular to outgoing
            offsetPoints.push({
                x: pCurr.x + normOut.x * offsetOut,
                y: pCurr.y + normOut.y * offsetOut
            });
        } else if (i === maxIdx && !line.closedLoop) {
            // End of open line: shift perpendicular to incoming
            offsetPoints.push({
                x: pCurr.x + normIn.x * offsetIn,
                y: pCurr.y + normIn.y * offsetIn
            });
        } else {
            // Corner intersection
            let pPrev = i > 0 ? rawPoints[i-1] : rawPoints[maxIdx]; // Wrap
            let pNext = i < maxIdx ? rawPoints[i+1] : rawPoints[1]; // Wrap
            
            // Re-calc for safety
            const dIn = getDir(pPrev, pCurr);
            const dOut = getDir(pCurr, pNext);
            
            // Simple offset fix if direction is zero
            if (Math.hypot(dIn.x, dIn.y) < 0.001 || Math.hypot(dOut.x, dOut.y) < 0.001) {
                offsetPoints.push(pCurr);
                continue;
            }

            const offIn = getLineOffset(pPrev, pCurr, line.id);
            const offOut = getLineOffset(pCurr, pNext, line.id);
            const nIn = getNormal(dIn);
            const nOut = getNormal(dOut);

            // Point on shifted incoming line
            const pInShift = { x: pCurr.x + nIn.x * offIn, y: pCurr.y + nIn.y * offIn };
            // Point on shifted outgoing line
            const pOutShift = { x: pCurr.x + nOut.x * offOut, y: pCurr.y + nOut.y * offOut };

            // Intersection
            offsetPoints.push(getLineIntersection(pInShift, dIn, pOutShift, dOut));
        }
    }

    if (line.closedLoop && offsetPoints.length > 0) {
         // Close the path visually
         offsetPoints.push(offsetPoints[0]); 
    }

    return generateSmoothPath(offsetPoints, 16);
  };

  // --- Station Rendering Logic (Pill vs Circle) ---
  const getStationShape = (station: Station) => {
    // 1. Find all lines going through this station
    const passingLines = lines.filter(l => l.stationIds.includes(station.id));
    
    // 2. Check if it's a "straight" bundle
    if (passingLines.length < 2) return { type: 'standard', count: 1, angle: 0 };
    
    let bundleDir: Point | null = null;
    let validPill = true;

    for (const line of passingLines) {
        const idx = line.stationIds.indexOf(station.id);
        const isStart = idx === 0;
        const isEnd = idx === line.stationIds.length - 1;
        const closed = line.closedLoop;
        
        let pPrev: Point | null = null;
        let pNext: Point | null = null;
        
        const stationPt = { x: station.x, y: station.y };

        // Find prev geometric point
        if (!isStart) {
            const sPrev = stations.find(s => s.id === line.stationIds[idx-1]);
            if (sPrev) {
                const seg = getOctolinearSegment(sPrev, stationPt, line.alternateRoute); // [...points]
                pPrev = seg[seg.length - 2]; // The point before station
            }
        } else if (closed) {
             const sPrev = stations.find(s => s.id === line.stationIds[line.stationIds.length - 1]);
             if (sPrev) {
                 const seg = getOctolinearSegment(sPrev, stationPt, line.alternateRoute);
                 pPrev = seg[seg.length - 2];
             }
        }

        // Find next geometric point
        if (!isEnd) {
             const sNext = stations.find(s => s.id === line.stationIds[idx+1]);
             if (sNext) {
                 const seg = getOctolinearSegment(stationPt, sNext, line.alternateRoute);
                 pNext = seg[1]; // The point after station
             }
        } else if (closed) {
             const sNext = stations.find(s => s.id === line.stationIds[0]);
             if (sNext) {
                 const seg = getOctolinearSegment(stationPt, sNext, line.alternateRoute);
                 pNext = seg[1];
             }
        }

        // Must pass through
        if (!pPrev || !pNext) {
             validPill = false; break;
        }

        const dIn = getDir(pPrev, stationPt);
        const dOut = getDir(stationPt, pNext);

        // Check if Straight
        const dot = dIn.x * dOut.x + dIn.y * dOut.y;
        if (dot < 0.99) { // Allow tiny error
             validPill = false; break; 
        }

        // Check compatibility with bundle
        if (!bundleDir) {
            bundleDir = dOut;
        } else {
            const bundleDot = bundleDir.x * dOut.x + bundleDir.y * dOut.y;
            if (bundleDot < 0.99) { validPill = false; break; }
        }
    }

    if (validPill && bundleDir) {
        const normal = getNormal(bundleDir);
        const angle = Math.atan2(normal.y, normal.x) * 180 / Math.PI;
        return { type: 'pill', count: passingLines.length, angle };
    }
    
    return { type: 'standard', count: passingLines.length, angle: 0 };
  };

  // --- Interaction Handlers ---
  const getRelativePoint = (clientX: number, clientY: number): Point => {
    if (!localSvgRef.current) return { x: 0, y: 0 };
    const rect = localSvgRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;
    return { 
      x: (rawX - transform.x) / transform.k, 
      y: (rawY - transform.y) / transform.k 
    };
  };
  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  useEffect(() => {
    if (!localSvgRef.current) return;
    const svg = d3.select(localSvgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        if (activeTool !== ToolMode.Select) return false;
        const target = event.target as Element;
        // Check for 'interactive-element' class to disable zoom on those elements
        if (target.closest && target.closest('.interactive-element')) return false;
        if (event.ctrlKey || event.button !== 0) return false;
        return true;
      })
      .on('zoom', (event) => setTransform(event.transform));
    svg.call(zoom);
    return () => { svg.on('.zoom', null); };
  }, [activeTool]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === ToolMode.AddStation) {
      onHistorySave(); // Save before adding
      const raw = getRelativePoint(e.clientX, e.clientY);
      onStationAdd({ x: snapToGrid(raw.x), y: snapToGrid(raw.y) });
    } else if (activeTool === ToolMode.Select) {
      if (e.target === localSvgRef.current || (e.target as Element).tagName === 'rect') {
        onStationSelect(null);
        onLineSelect(null);
      }
    }
  };

  const handleStationMouseDown = (e: React.MouseEvent, station: Station) => {
    e.stopPropagation(); 
    if (activeTool === ToolMode.Select) {
      onStationSelect(station.id);
      onHistorySave(); // Save state before potentially moving
      // We use client coordinates for the drag start to calculate delta later
      setDragState({
        type: 'STATION',
        stationId: station.id,
        startPoint: { x: e.clientX, y: e.clientY },
        originalPos: { x: station.x, y: station.y }
      });
    } else if (activeTool === ToolMode.AddLine) {
      onHistorySave(); // Save before adding line connection
      onLineAdd(station.id);
    } else if (activeTool === ToolMode.Delete) {
      onHistorySave(); // Save before delete
      onDelete('station', station.id);
    }
  };

  const handleLabelMouseDown = (e: React.MouseEvent, station: Station) => {
      e.stopPropagation();
      if (activeTool === ToolMode.Select) {
          onStationSelect(station.id);
          onHistorySave();
          setDragState({
              type: 'LABEL',
              stationId: station.id,
              startPoint: { x: e.clientX, y: e.clientY },
              originalPos: station.labelOffset || DEFAULT_LABEL_OFFSET
          });
      }
  };
  
  // Refactored Drag Logic using Window Listeners
  useEffect(() => {
    if (!dragState) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
       e.preventDefault();
       // Delta in screen pixels
       const dxScreen = e.clientX - dragState.startPoint.x;
       const dyScreen = e.clientY - dragState.startPoint.y;
       
       // Convert delta to SVG coordinates based on current zoom scale
       const dx = dxScreen / transform.k;
       const dy = dyScreen / transform.k;
       
       if (dragState.type === 'STATION') {
           onStationMove(dragState.stationId, {
               x: snapToGrid(dragState.originalPos.x + dx),
               y: snapToGrid(dragState.originalPos.y + dy)
           });
       } else if (dragState.type === 'LABEL') {
           const rawX = dragState.originalPos.x + dx;
           const rawY = dragState.originalPos.y + dy;
           
           // Constrain distance
           const dist = Math.hypot(rawX, rawY);
           let finalX = rawX;
           let finalY = rawY;
           
           if (dist > MAX_LABEL_DISTANCE) {
               const angle = Math.atan2(rawY, rawX);
               finalX = Math.cos(angle) * MAX_LABEL_DISTANCE;
               finalY = Math.sin(angle) * MAX_LABEL_DISTANCE;
           }

           onStationLabelMove(dragState.stationId, { x: finalX, y: finalY });
       }
    };

    const handleWindowMouseUp = () => {
        setDragState(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragState, transform, onStationMove, onStationLabelMove]);


  const handleLineClick = (e: React.MouseEvent, lineId: string) => {
    e.stopPropagation();
    if (activeTool === ToolMode.Select) onLineSelect(lineId);
    else if (activeTool === ToolMode.Delete) {
        onHistorySave(); // Save before delete
        onDelete('line', lineId);
    }
  };


  return (
    <div 
      ref={containerRef} 
      className={`flex-1 bg-slate-950 relative overflow-hidden select-none
        ${activeTool === ToolMode.Select ? 'cursor-grab active:cursor-grabbing' : ''}
        ${activeTool === ToolMode.AddStation ? 'cursor-crosshair' : ''}
        ${activeTool === ToolMode.AddLine ? 'cursor-alias' : ''}
        ${activeTool === ToolMode.Delete ? 'cursor-not-allowed' : ''}
      `}
    >
      <svg
        ref={localSvgRef}
        className="w-full h-full block touch-none"
        onMouseDown={handleMouseDown}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          
          <defs>
            <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#1e293b" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid)" className="pointer-events-none" />

          {/* Lines */}
          {lines.map(line => (
            <path
              key={line.id}
              d={getLinePath(line)}
              stroke={line.color}
              strokeWidth={line.width}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`interactive-element transition-opacity duration-200 cursor-pointer hover:opacity-80 
                ${selectedLineId === line.id ? 'opacity-100 filter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'opacity-90'}`}
              onClick={(e) => handleLineClick(e, line.id)}
            />
          ))}

          {/* Stations */}
          {stations.map(station => {
            const isSelected = selectedStationId === station.id;
            const shape = getStationShape(station);
            const labelOffset = station.labelOffset || DEFAULT_LABEL_OFFSET;
            
            // Render logic based on shape
            let content;
            if (shape.type === 'pill') {
                const width = DEFAULT_STATION_RADIUS * 2 + (shape.count - 1) * LINE_SPACING;
                const height = DEFAULT_STATION_RADIUS * 2;
                // Centered rounded rect
                content = (
                  <rect 
                    x={-width/2} y={-height/2} 
                    width={width} height={height} 
                    rx={height/2}
                    transform={`rotate(${shape.angle})`}
                    fill="white" stroke="#0f172a" strokeWidth="3"
                    className="transition-transform group-hover:scale-110"
                  />
                );
            } else {
                // Fallback to standard types
                let radius = DEFAULT_STATION_RADIUS;
                if (station.type === StationType.Interchange) radius = INTERCHANGE_RADIUS;
                if (station.type === StationType.Waypoint) radius = WAYPOINT_RADIUS;

                if (station.type === StationType.Square) {
                    content = <rect x={-radius} y={-radius} width={radius*2} height={radius*2} fill="white" stroke="#0f172a" strokeWidth="3" className="transition-transform group-hover:scale-110"/>;
                } else if (station.type === StationType.Interchange) {
                    content = (
                        <>
                           <circle r={radius} fill="white" stroke="#0f172a" strokeWidth="3" />
                           <circle r={radius * 0.5} fill="#0f172a" />
                        </>
                    );
                } else if (station.type === StationType.Waypoint) {
                    content = <circle r={radius} fill={isSelected ? "#3b82f6" : "transparent"} stroke={isSelected ? "white" : "rgba(255,255,255,0.2)"} strokeWidth="1" className="group-hover:fill-slate-500" />;
                } else {
                    // Standard Circle
                    content = <circle r={radius} fill="white" stroke="#0f172a" strokeWidth="3" className="transition-transform group-hover:scale-110"/>;
                }
            }

            return (
              <g 
                key={station.id} 
                transform={`translate(${station.x},${station.y})`}
              >
                {/* Station Hit Area & Shape */}
                <g 
                   onMouseDown={(e) => handleStationMouseDown(e, station)}
                   className="interactive-element cursor-pointer group"
                >
                    {/* Selection halo */}
                    {isSelected && (
                       <circle r={Math.max(DEFAULT_STATION_RADIUS, INTERCHANGE_RADIUS) + 8} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" className="animate-spin-slow" />
                    )}
                    {content}
                </g>

                {/* Station Label */}
                {station.type !== StationType.Waypoint && (
                   <g transform={`translate(${labelOffset.x}, ${labelOffset.y})`} className="interactive-element">
                       {/* Optional connection line if label is far */}
                       {isSelected && Math.hypot(labelOffset.x, labelOffset.y) > 20 && (
                           <line 
                             x1={-labelOffset.x} y1={-labelOffset.y} x2={0} y2={0}
                             stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" opacity="0.5"
                           />
                       )}
                       
                       {/* Anchor dot if selected */}
                       {isSelected && (
                          <circle cx="0" cy="0" r="3" fill="#3b82f6" stroke="white" strokeWidth="1" className="animate-pulse" />
                       )}

                       <text
                            onMouseDown={(e) => handleLabelMouseDown(e, station)}
                            fill={isSelected ? '#60a5fa' : '#e2e8f0'}
                            className={`text-[10px] font-medium select-none drop-shadow-md cursor-move ${isSelected ? 'font-bold' : ''}`}
                            style={{ fontSize: Math.max(10, 10 / transform.k) + 'px' }}
                            textAnchor="start"
                            dominantBaseline="central"
                        >
                            {station.name}
                        </text>
                        {/* Invisible larger hit area for easier text grabbing */}
                        <rect 
                             onMouseDown={(e) => handleLabelMouseDown(e, station)}
                             x="-10" y="-15" width="120" height="30" fill="transparent" className="cursor-move"
                        />
                   </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute bottom-4 left-4 text-xs text-slate-500 pointer-events-none bg-slate-900/80 p-2 rounded border border-slate-800">
         Zoom: {transform.k.toFixed(2)}x | Grid: {GRID_SIZE}px
      </div>
    </div>
  );
});
