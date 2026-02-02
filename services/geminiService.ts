import { GoogleGenAI, Type } from "@google/genai";
import { ThemeSuggestion, Station, Line, StationType } from '../types';

const apiKey = process.env.API_KEY || '';

// Fallback mock for theme
const MOCK_SUGGESTION: ThemeSuggestion = {
  name: "Neo-Tokyo Transit",
  description: "A futuristic high-speed rail network connecting cyberpunk districts.",
  lineColors: ["#00ffff", "#ff00ff", "#ffff00", "#00ff00"],
  stationNames: ["Shibuya Cyber", "Neo-Shinjuku", "Akiba Tech", "Roppongi Hills 2.0", "Ginza Lights", "Odaiba Port", "Ueno Park Digital"]
};

// Fallback mock for full layout
const MOCK_LAYOUT = {
  stations: [
    { id: 'm1', name: 'Central Station', x: 400, y: 300, type: 'INTERCHANGE' as StationType },
    { id: 'm2', name: 'North Park', x: 400, y: 100, type: 'CIRCLE' as StationType },
    { id: 'm3', name: 'East Side', x: 600, y: 300, type: 'SQUARE' as StationType },
    { id: 'm4', name: 'West End', x: 200, y: 300, type: 'SQUARE' as StationType },
    { id: 'm5', name: 'South Harbor', x: 400, y: 500, type: 'CIRCLE' as StationType },
  ],
  lines: [
    { id: 'l1', name: 'Cross Line', color: '#3b82f6', width: 6, stationIds: ['m4', 'm1', 'm3'] },
    { id: 'l2', name: 'Vertical Line', color: '#ef4444', width: 6, stationIds: ['m2', 'm1', 'm5'] }
  ]
};

export const generateNetworkTheme = async (prompt: string): Promise<ThemeSuggestion> => {
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return new Promise(resolve => setTimeout(() => resolve(MOCK_SUGGESTION), 1000));
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a creative transportation network theme based on: "${prompt}". 
      Return a JSON object with a system name, a short description, a palette of 5 hex colors, and a list of 10 creative station names that fit the theme.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            lineColors: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            stationNames: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["name", "description", "lineColors", "stationNames"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ThemeSuggestion;
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return MOCK_SUGGESTION;
  }
};

export const suggestStationNames = async (currentNames: string[], context: string): Promise<string[]> => {
    if (!apiKey) return ["Station A", "Station B", "Station C"];

    const ai = new GoogleGenAI({ apiKey });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `The current station names are: ${currentNames.join(', ')}. Context: ${context}. Suggest 5 new unique station names that fit nicely.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        if (response.text) {
            return JSON.parse(response.text) as string[];
        }
        return [];
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const generateMapLayout = async (prompt: string): Promise<{ stations: Station[], lines: Line[] } | null> => {
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return new Promise(resolve => setTimeout(() => resolve(MOCK_LAYOUT), 1500));
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a full schematic transportation map layout for: "${prompt}".
      
      Requirements:
      1. Create a logical set of stations with coordinates. 
         - X range: 100 to 900
         - Y range: 100 to 700
         - Coordinates should be roughly aligned to a 20px grid.
      2. Accurately represent the real-world system if the prompt refers to a real city (e.g. Madrid, London, Tokyo), matching their approximate relative geography and line colors.
      3. If it's a fictional theme, be creative with the layout.
      4. Stations where lines cross MUST be type 'INTERCHANGE'. End of lines should be 'SQUARE'. Regular stations 'CIRCLE'.
      5. Include the main lines and key stations (limit to ~20-30 stations and 3-5 lines to keep it clean, unless the system is simple).
      6. Return a valid JSON object with 'stations' and 'lines'.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["CIRCLE", "SQUARE", "INTERCHANGE", "WAYPOINT"] }
                },
                required: ["id", "name", "x", "y", "type"]
              }
            },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  color: { type: Type.STRING },
                  width: { type: Type.NUMBER },
                  stationIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  closedLoop: { type: Type.BOOLEAN }
                },
                required: ["id", "name", "color", "stationIds"]
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      // Ensure defaults if missing
      const processedLines = data.lines.map((l: any) => ({
        ...l,
        width: l.width || 6,
        closedLoop: l.closedLoop || false
      }));
      return { stations: data.stations, lines: processedLines };
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error (Layout):", error);
    return null;
  }
};
