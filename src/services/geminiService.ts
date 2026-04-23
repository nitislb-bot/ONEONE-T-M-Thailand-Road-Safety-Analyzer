import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BlackSpot {
  locationName: string;
  latitude: number;
  longitude: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  accidentCount: number;
  injuryCount: number;
  fatalityCount: number;
  riskFactors: string[];
  recommendation: string;
  confirmations?: number;
  comments?: { text: string; timestamp: number }[];
}

export interface Accident {
  id: string;
  locationName: string;
  latitude: number;
  longitude: number;
  type: string;
  severity: 'Minor' | 'Major' | 'Fatal';
  timestamp: string;
  description: string;
  confirmations?: number;
  comments?: { text: string; timestamp: number }[];
}

export interface SafetyAnalysis {
  id?: string;
  timestamp?: number;
  province?: string;
  district?: string;
  workOrderName?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  customRiskFactors?: string[];
  overallRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  historicalDataSummary?: string;
  blackSpots: BlackSpot[];
  recentAccidents: Accident[];
}

export async function analyzeArea(
  province: string, 
  district: string,
  historicalData?: string,
  customRiskFactors?: string[]
): Promise<SafetyAnalysis> {
  let prompt = `Analyze the road safety in the district/city of "${district}" within the province of "${province}".
Using data referenced from https://www.thairsc.com/ (Thai Road Safety Culture), local news, and official reports, identify:
1. AT LEAST 70 specific "Black Spots" (historical high-risk zones).
2. AT LEAST 30 RECENT accidents (reported in the last 7-30 days).

CRITICAL ACCURACY REQUIREMENTS:
- You MUST provide high-precision latitude and longitude coordinates for EVERY point.
- Location Name Format: Provide the road name or intersection in BOTH Thai and English (e.g., "ถนนสุขุมวิท / Sukhumvit Road").
- Use specific kilometer markers (e.g., "Highway 1, KM 45+200"), major intersections, or recognizable landmarks to pinpoint locations.
- Verify coordinates: Cross-reference the location name with its real-world coordinates. Do NOT provide generic coordinates for the entire district.
- Each point must be unique and accurately placed on the map.
- If a report mentions a specific bridge, school, or hospital, use those coordinates.

For each Black Spot, provide accident statistics and driving advice.
For each Recent Accident, provide the type, severity, and a brief description.

CONTENT STYLE REQUIREMENTS:
- Risk Factors: Use short, punchy phrases (e.g., "Blind Spot", "Slippery Road", "No Streetlights").
- Recommendations: Use clear, actionable instructions (e.g., "Slow down to 40km/h", "Use high beams", "Watch for U-turns").
- Keep descriptions concise and easy to read at a glance.

You MUST return a minimum of 100 total points (Black Spots + Recent Accidents).`;

  if (customRiskFactors && customRiskFactors.length > 0) {
    prompt += `\n\nUSER-SPECIFIED RISK FACTORS TO PRIORITIZE:
${customRiskFactors.map(factor => `- ${factor}`).join('\n')}`;
  }

  if (historicalData) {
    prompt += `\n\nUSER OBSERVATIONS ABOUT PHYSICAL CITY DETAILS:
${historicalData}`;
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "Act as an expert in road safety data analysis for Thailand. Use Google Search to find real-world hazards, 'Black Spots', and RECENT accident reports (last 30 days) from official sources like ThaiRSC (thairsc.com), local news (Khaosod, Thairath), and social media reports. Identify specific hazards within the specified province and district. Be sure to identify specific risk factors such as 'poor lighting', 'sharp curves', 'steep slope', 'no traffic signal', etc., as these will be visualized on the map. You MUST provide precise latitude and longitude coordinates for each point. Location names MUST be provided in BOTH Thai and English (e.g., 'ถนนสุขุมวิท / Sukhumvit Road'). If a report mentions a specific intersection, landmark, or kilometer marker (e.g., KM 12+500), find the exact coordinates for that location. Verify every coordinate against the location description to ensure accuracy. Do NOT use the same coordinates for multiple points. Provide actionable driving advice. Use extremely concise language for risk factors and recommendations (max 5-7 words each). You must always provide a JSON response with at least 100 total points across 'blackSpots' and 'recentAccidents'.",
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallRisk: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
          summary: { type: Type.STRING },
          historicalDataSummary: { type: Type.STRING },
          blackSpots: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                locationName: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
                accidentCount: { type: Type.INTEGER },
                injuryCount: { type: Type.INTEGER },
                fatalityCount: { type: Type.INTEGER },
                riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendation: { type: Type.STRING }
              },
              required: ["locationName", "latitude", "longitude", "riskLevel", "accidentCount", "injuryCount", "fatalityCount", "riskFactors", "recommendation"]
            }
          },
          recentAccidents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                locationName: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                type: { type: Type.STRING, description: "e.g., Multi-vehicle collision, Motorcycle accident" },
                severity: { type: Type.STRING, enum: ["Minor", "Major", "Fatal"] },
                timestamp: { type: Type.STRING, description: "Approximate date/time of accident" },
                description: { type: Type.STRING }
              },
              required: ["id", "locationName", "latitude", "longitude", "type", "severity", "timestamp", "description"]
            }
          }
        },
        required: ["overallRisk", "summary", "blackSpots", "recentAccidents"]
      }
    }
  });

  if (!response.text) {
    throw new Error("No response received from the analysis service. Please try again.");
  }

  try {
    return JSON.parse(response.text) as SafetyAnalysis;
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", response.text);
    throw new Error("Unable to generate a valid safety analysis. The locations provided might be unrecognized, or there is insufficient data for this specific area.");
  }
}

export async function getDetailedAccidentReport(
  province: string,
  district: string,
  accidents: Accident | Accident[],
  language: 'English' | 'Thai' = 'English'
): Promise<string> {
  const accidentList = Array.isArray(accidents) ? accidents : [accidents];
  const prompt = `Provide a detailed, professional accident analysis report for the district of "${district}" in "${province}".
  
  LANGUAGE: Provide the entire report in ${language}.
  
  CONTEXT:
  The following accident(s) have been identified:
  ${accidentList.map(a => `- ${a.timestamp}: ${a.type} at ${a.locationName}. Severity: ${a.severity}. Description: ${a.description}`).join('\n')}
  
  YOUR TASK:
  1. Analyze the specific details of ${accidentList.length > 1 ? 'these accidents' : 'this accident'}.
  2. ${accidentList.length > 1 ? 'Analyze patterns and provide narratives for significant cases.' : 'Provide a deep narrative of the incident, including potential causes and environmental factors.'}
  3. Offer specific, data-driven safety recommendations for local authorities and drivers.
  4. ADVANCED PRECAUTIONS: Provide a dedicated section titled "Precautions for Drivers" (in ${language}) detailing EXACTLY what a driver should do when passing through these specific roads (e.g., speed adjustment, eye placement, gear selection if steep, specific lane positioning).
  5. Use professional, authoritative language.
  6. Format the output with clear headings and bullet points using Markdown.
  
  The report should be comprehensive and provide "More Detail" as requested by the user to better understand the accident landscape and exactly how to navigate it safely.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a senior road safety consultant. Your goal is to provide deep insights into accident data, helping users understand the 'why' and 'how' behind local traffic incidents. Use Google Search to find additional context about the specific roads or intersections mentioned if needed.",
      tools: [{ googleSearch: {} }]
    }
  });

  return response.text || "Unable to generate a detailed report at this time.";
}
