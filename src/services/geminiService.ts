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
  aiSummary?: string;
  avoidanceTip?: string;
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
1. AT LEAST 25 specific "Black Spots" (historical high-risk zones).
2. AT LEAST 15 RECENT accidents (reported in the last 7-30 days).

LANGUAGE REQUIREMENT:
- All descriptive fields (summary, historicalDataSummary, riskFactors, recommendation, descriptions, aiSummary, avoidanceTip) MUST be written in the THAI language.
- Location names should be in BOTH Thai and English.

CRITICAL ACCURACY REQUIREMENTS:
- You MUST provide high-precision latitude and longitude coordinates for EVERY point.
- Location Name Format: Provide the road name or intersection in BOTH Thai and English (e.g., "ถนนสุขุมวิท / Sukhumvit Road").
- Use specific kilometer markers (e.g., "Highway 1, KM 45+200"), major intersections, or recognizable landmarks to pinpoint locations.
- Each point must be unique and accurately placed on the map.
- If a report mentions a specific bridge, school, or hospital, use those coordinates.

You MUST return a total of around 40-50 high-quality points (Black Spots + Recent Accidents).`;

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
      systemInstruction: "Act as an expert in road safety data analysis for Thailand. Use Google Search to find real-world hazards, 'Black Spots', and RECENT accident reports (last 30 days). Identify specific hazards within the specified province and district. You MUST provide precise latitude and longitude coordinates for each point. Location names MUST be provided in BOTH Thai and English. Do NOT use the same coordinates for multiple points. Provide actionable driving advice. CRITICAL: All textual analysis (summary, historicalDataSummary, riskFactors, recommendation, descriptions, aiSummary, avoidanceTip) MUST be written entirely in the THAI language to assure local Thai drivers can understand easily.",
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
                description: { type: Type.STRING, description: "Short description of the event" },
                aiSummary: { type: Type.STRING, description: "Expert AI summary of what happened (1-2 sentences)" },
                avoidanceTip: { type: Type.STRING, description: "Direct advice for drivers on how to avoid similar accidents at this location" }
              },
              required: ["id", "locationName", "latitude", "longitude", "type", "severity", "timestamp", "description", "aiSummary", "avoidanceTip"]
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

export async function analyzeAccidentTrends(
  province: string,
  district: string,
  accidents: Accident[]
): Promise<string> {
  if (accidents.length === 0) return "No accident data available for trend analysis.";

  const prompt = `Perform a high-level statistical and trend analysis on the following accident data for ${district}, ${province}:
  
  DATASET:
  ${accidents.map(a => `- [${a.severity}] ${a.type} at ${a.locationName} (${a.timestamp}): ${a.description}`).join('\n')}
  
  REQUIRED ANALYSIS:
  1. SEVERITY DISTRIBUTION: Summarize the ratio of Fatal, Major, and Minor accidents.
  2. SPATIAL CLUSTERING: Identify if certain roads or intersections appear repeatedly.
  3. TEMPORAL PATTERNS: Based on timestamps and descriptions, identify 'high-risk hours' (e.g., night-time, rush hour).
  4. CAUSAL PATTERNS: Identify recurring accident types (e.g., 'Motorcycle vs Truck', 'Rear-end').
  5. ACTIONABLE SUMMARY: Provide a 1-paragraph summary of the safety 'vibe' of this area.
  
  FORMAT: Use Markdown with clear bullet points and bold headings. Be concise but insightful.
  CRITICAL: The entire output MUST be written in the THAI language.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a data scientist specializing in traffic safety analytics. Your goal is to find hidden patterns in raw accident reports to help Thai stakeholders make informed decisions. Speak entirely in Thai."
    }
  });

  return response.text || "Unable to generate trend analysis.";
}

export interface JourneySafetyReport {
  id?: string;
  timestamp?: number;
  createdBy?: string;
  origin: string;
  destination: string;
  routeSummary: string;
  overallSafetyRating: 'Safe' | 'Caution' | 'High Risk';
  weatherAlerts: { condition: string; impact: string; severity: 'Low' | 'Medium' | 'High' }[];
  trafficConditions: { location: string; status: string; delayMinutes: number }[];
  hazardsOnRoute: { location: string; hazardType: string; description: string; lat: number; lng: number }[];
  saferAlternative?: { description: string; reasoning: string };
  adviseForDriver: string;
}

export interface CoachingModule {
  title: string;
  category: 'Technique' | 'Awareness' | 'Equipment' | 'Mental';
  tips: string[];
  trainingSteps: string[];
  riskRelation: string;
}

export interface DriverCoachingReport {
  id?: string;
  timestamp?: number;
  createdBy?: string;
  locationContext?: string;
  summary: string;
  riskProfile: string;
  modules: CoachingModule[];
  personalizedChecklist: string[];
}

export async function getDriverCoaching(
  analysis: SafetyAnalysis,
  journeyPlan?: JourneySafetyReport
): Promise<DriverCoachingReport> {
  const prompt = `Act as an AI Driver Coach. Based on the following safety data, generate a personalized "Driver Coaching & Training Program".

AREA SAFETY CONTEXT:
Summary: ${analysis.summary}
Overall Risk: ${analysis.overallRisk}
Accident Patterns: ${analysis.recentAccidents.map(a => a.type).join(', ')}

${journeyPlan ? `JOURNEY CONTEXT:
Route: ${journeyPlan.origin} to ${journeyPlan.destination}
Hazards: ${journeyPlan.hazardsOnRoute.map(h => h.hazardType).join(', ')}
Advice: ${journeyPlan.adviseForDriver}` : ''}

YOUR TASK:
1. RISK PROFILE: Briefly summarize the specific areas where this driver needs to improve based on the local accident patterns (e.g., if there are many motorcycle collisions, focus on blind-spot awareness).
2. COACHING MODULES: Provide 3-4 structured training modules. Each module should include:
   - A clear title.
   - A category (Technique, Awareness, Equipment, or Mental).
   - 3 actionable tips.
   - 3 training steps (drills or exercises the driver can do).
   - Risk Relation: Explain exactly how this module reduces the risk of the specific accidents detected in the area/journey.
3. PERSONALIZED CHECKLIST: A 5-point checklist for the driver to review before they start their engine.

FORMAT: Return a JSON object matching the DriverCoachingReport structure.
CRITICAL: ALL text output MUST be in the THAI language so the Thai driver can easily understand.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are a professional defensive driving instructor using data-driven insights to coach corporate and individual drivers. Your tone is supportive but firm on safety. Focus on root causes found in the accident data. Speak entirely in Thai.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          riskProfile: { type: Type.STRING },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING, enum: ["Technique", "Awareness", "Equipment", "Mental"] },
                tips: { type: Type.ARRAY, items: { type: Type.STRING } },
                trainingSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                riskRelation: { type: Type.STRING }
              },
              required: ["title", "category", "tips", "trainingSteps", "riskRelation"]
            }
          },
          personalizedChecklist: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["summary", "riskProfile", "modules", "personalizedChecklist"]
      }
    }
  });

  if (!response.text) throw new Error("Driver Coaching Service is temporarily unavailable.");
  try {
    return JSON.parse(response.text) as DriverCoachingReport;
  } catch (e) {
    throw new Error("Failed to parse coaching data.");
  }
}

export async function getJourneySafetyPlan(
  origin: string,
  destination: string,
  departureTime?: string,
  areaAnalysisContext?: SafetyAnalysis
): Promise<JourneySafetyReport> {
  let contextString = '';
  if (areaAnalysisContext) {
    contextString = `
  AREA SAFETY CONTEXT (from current analysis):
  Province: ${areaAnalysisContext.province}
  District: ${areaAnalysisContext.district}
  Overall Area Risk: ${areaAnalysisContext.overallRisk}
  Area Summary: ${areaAnalysisContext.summary}
  Recent Accidents in this area: ${areaAnalysisContext.recentAccidents?.map(a => a.type + ' at ' + a.locationName).join(', ')}
  
  Use this area context to provide a much deeper detail in the journey plan if the route passes through this area.
    `;
  }

  const prompt = `Develop a "Smart Journey Safety Management Plan" for a drive from "${origin}" to "${destination}"${departureTime ? ` departing at ${departureTime}` : ''}.
  ${contextString}
  
  LANGUAGE REQUIREMENT:
  - Every single word of the conversational response (routeSummary, weatherAlerts, traffic status, hazard descriptions, advice) MUST be in the THAI language.
  - Overall Safety Rating must be one of: Safe, Caution, High Risk (English values for the schema).

  Using Google Search, you MUST retrieve:
  1. CURRENT WEATHER: Find the real-time weather forecast along the route (e.g., rain, fog, high winds in Thailand).
  2. REAL-TIME TRAFFIC: Search for major accidents, construction, or heavy congestion currently reported on the likely path.
  3. HISTORICAL HAZARDS: Identify known "Black Spots" or sharp curves on the main highways connecting these two points.
  
  REQUIRED OUTPUT:
  - Overall Safety Rating: (Safe / Caution / High Risk)
  - Weather Alerts: List specific weather conditions and their impact on driving (e.g., "ถนนลื่นเนื่องจากฝนตก").
  - Traffic: List bottlenecks and delays.
  - Hazards: Pinpoint at least 3 specific coordinates (lat/lng) of dangerous segments on this route.
  - Alternative: Suggest if there is a safer (even if slightly longer) path to avoid a high-risk zone.
  - Driver Advice: Provide 3-4 professional coaching tips tailored to this specific route.
  
  Coordinates are CRITICAL. Find the exact latitude and longitude for any hazards mentioned.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are an AI Traffic Safety Dispatcher. Your goal is to provide real-time situational awareness for long-distance drivers in Thailand. CRITICAL: All conversational strings (summaries, tips, conditions) MUST be written in the THAI language to help Thai drivers understand easily. You use Google Search to find current event data and historical hazard data to create a predictive safety plan.",
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          origin: { type: Type.STRING },
          destination: { type: Type.STRING },
          routeSummary: { type: Type.STRING },
          overallSafetyRating: { type: Type.STRING, enum: ["Safe", "Caution", "High Risk"] },
          weatherAlerts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                condition: { type: Type.STRING },
                impact: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ["Low", "Medium", "High"] }
              }
            }
          },
          trafficConditions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING },
                status: { type: Type.STRING },
                delayMinutes: { type: Type.NUMBER }
              }
            }
          },
          hazardsOnRoute: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING },
                hazardType: { type: Type.STRING },
                description: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              }
            }
          },
          saferAlternative: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            }
          },
          adviseForDriver: { type: Type.STRING }
        },
        required: ["origin", "destination", "routeSummary", "overallSafetyRating", "weatherAlerts", "trafficConditions", "hazardsOnRoute", "adviseForDriver"]
      }
    }
  });

  if (!response.text) throw new Error("Safety Dispatcher is unavailable.");
  return JSON.parse(response.text) as JourneySafetyReport;
}
