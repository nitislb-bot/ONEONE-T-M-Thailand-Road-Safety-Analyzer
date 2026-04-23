import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { BlackSpot, Accident, JourneySafetyReport } from '../services/geminiService';
import { PlusCircle, AlertCircle, MapPin, Navigation, Info, X, Edit2, Save, Trash2, AlertTriangle, Move, MessageSquare, ThumbsUp, Send, ChevronDown, ChevronUp, Route, Wind } from 'lucide-react';

import { Locale, translations } from '../i18n';

// Fix Leaflet's default icon path issues with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getMarkerColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'Critical': return '#ef4444'; // red-500
    case 'High': return '#f97316'; // orange-500
    case 'Medium': return '#eab308'; // yellow-500
    case 'Low': return '#22c55e'; // green-500
    default: return '#3b82f6'; // blue-500
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'Critical': return 'bg-red-900/40 text-red-200 border-red-500/50';
    case 'High': return 'bg-orange-900/40 text-orange-200 border-orange-500/50';
    case 'Medium': return 'bg-yellow-900/40 text-yellow-200 border-yellow-500/50';
    case 'Low': return 'bg-green-900/40 text-green-200 border-green-500/50';
    default: return 'bg-blue-900/40 text-blue-200 border-blue-500/50';
  }
};

const iconCache: Record<string, L.DivIcon> = {};
const getCachedIcon = (color: string, isAccident = false) => {
  const key = `${color}-${isAccident}`;
  if (!iconCache[key]) {
    // Larger touch targets for mobile (at least 36px)
    const isMobile = window.innerWidth < 768;
    const baseSize = isAccident ? 32 : 24;
    const size = isMobile ? baseSize * 1.5 : baseSize;
    // Increase hit area with transparent padding
    const hitAreaSize = size + (isMobile ? 16 : 8);
    
    iconCache[key] = L.divIcon({
      className: 'custom-icon',
      html: `<div style="width: ${hitAreaSize}px; height: ${hitAreaSize}px; display: flex; align-items: center; justify-content: center; background: transparent;">
        <div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${isMobile ? '3px' : '2px'} solid ${isMobile ? '#1e293b' : 'white'}; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center;">
          ${isAccident ? `<span style="color: white; font-weight: bold; font-size: ${isMobile ? '22px' : '16px'}; line-height: 1;">!</span>` : ''}
        </div>
      </div>`,
      iconSize: [hitAreaSize, hitAreaSize],
      iconAnchor: [hitAreaSize / 2, hitAreaSize / 2],
      popupAnchor: [0, -hitAreaSize / 2],
    });
  }
  return iconCache[key];
};

const RiskSpotMarker = React.memo(({ 
  spot, 
  onUpdateSpot, 
  onDeleteSpot, 
  startEditing, 
  editingSpotIndex, 
  editForm, 
  handleSaveEdit, 
  handleCancelEdit, 
  setEditForm, 
  setDeleteConfirmSpot,
  onHideUi,
  locale, 
  t 
}: any) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const hasPoorLighting = spot.riskFactors.some((f: string) => 
    f.toLowerCase().includes('lighting') || 
    f.toLowerCase().includes('dark') || 
    f.toLowerCase().includes('visibility')
  );
  const hasSharpCurves = spot.riskFactors.some((f: string) => 
    f.toLowerCase().includes('curve') || 
    f.toLowerCase().includes('winding') || 
    f.toLowerCase().includes('bend')
  );

  return (
    <React.Fragment>
      {hasSharpCurves && (
        <Polyline 
          positions={generateCurvePoints(spot.latitude, spot.longitude)}
          pathOptions={{ color: '#ef4444', weight: 3, dashArray: '5, 10' }}
        />
      )}
      {hasPoorLighting && (
        <Circle 
          center={[spot.latitude, spot.longitude]} 
          radius={50}
          pathOptions={{ 
            fillColor: '#a855f7', 
            fillOpacity: 0.15, 
            color: '#9333ea', 
            weight: 1,
            dashArray: '15, 5'
          }}
        />
      )}
      <Marker
        position={[spot.latitude, spot.longitude]}
        icon={getCachedIcon(getMarkerColor(spot.riskLevel))}
        draggable={true}
        bubblingMouseEvents={false}
        eventHandlers={{
          click: () => {
            if (window.innerWidth < 768) {
              onHideUi();
            }
          },
          dragend: (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            onUpdateSpot(spot.originalIndex, { ...spot, latitude: position.lat, longitude: position.lng });
          },
        }}
      >
        <Popup minWidth={240} autoPanPadding={[20, 20]}>
          {editingSpotIndex === spot.originalIndex && editForm ? (
            <div className="p-3 min-w-[280px] max-w-sm bg-white rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  {t.editLocation}
                </h3>
                <button onClick={handleCancelEdit} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3 text-black">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.locationName}</label>
                  <input 
                    type="text" 
                    className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none text-black"
                    value={editForm.locationName}
                    onChange={(e) => setEditForm({ ...editForm, locationName: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.riskLevel}</label>
                  <select 
                    className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none text-black"
                    value={editForm.riskLevel}
                    onChange={(e) => setEditForm({ ...editForm, riskLevel: e.target.value as any })}
                  >
                    <option value="Low">{locale === 'en' ? 'Low' : 'ต่ำ'}</option>
                    <option value="Medium">{locale === 'en' ? 'Medium' : 'ปานกลาง'}</option>
                    <option value="High">{locale === 'en' ? 'High' : 'สูง'}</option>
                    <option value="Critical">{locale === 'en' ? 'Critical' : 'วิกฤต'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.riskFactorsTitle}</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded bg-gray-50 text-black">
                    {editForm.riskFactors.map((factor: string, i: number) => (
                      <div key={i} className="flex gap-1">
                        <input 
                          type="text" 
                          className="flex-1 px-2 py-1 text-xs border rounded outline-none focus:ring-1 focus:ring-blue-500 text-black"
                          value={factor}
                          onChange={(e) => {
                            const newFactors = [...editForm.riskFactors];
                            newFactors[i] = e.target.value;
                            setEditForm({ ...editForm, riskFactors: newFactors });
                          }}
                          placeholder={t.customRiskPlaceholder}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const newFactors = editForm.riskFactors.filter((_: any, idx: number) => idx !== i);
                            setEditForm({ ...editForm, riskFactors: newFactors });
                          }}
                          className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                          title="Remove factor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setEditForm({ ...editForm, riskFactors: [...editForm.riskFactors, ''] })}
                      className="w-full py-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-100 border border-dashed border-blue-300 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <PlusCircle className="w-3 h-3" />
                      {locale === 'en' ? 'Add New Factor' : 'เพิ่มปัจจัยความเสี่ยง'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.recommendation}</label>
                  <textarea 
                    className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none h-16 resize-none text-black"
                    value={editForm.recommendation}
                    onChange={(e) => setEditForm({ ...editForm, recommendation: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.coordinates} ({t.dragToUpdate})</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-100 px-2 py-1.5 rounded text-xs text-gray-600 font-mono">
                      Lat: {editForm.latitude.toFixed(6)}
                    </div>
                    <div className="bg-gray-100 px-2 py-1.5 rounded text-xs text-gray-600 font-mono">
                      Lng: {editForm.longitude.toFixed(6)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleSaveEdit}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {t.save}
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmSpot(editingSpotIndex)}
                    className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded text-sm font-bold transition-colors"
                    title={t.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleCancelEdit}
                    className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded text-sm font-bold transition-colors"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2 max-w-[280px]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-sm leading-tight text-slate-800 pr-6 truncate">{spot.locationName}</h3>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-all sm:hidden"
                    title={isMinimized ? t.expand : t.minimize}
                  >
                    {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                  <button 
                    onClick={() => startEditing(spot.originalIndex, spot)}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-all"
                    title={t.edit}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              {!isMinimized && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold uppercase mb-2 bg-blue-50 p-1 rounded border border-blue-100">
                    <Move className="w-3 h-3" />
                    {t.dragToCorrect}
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-600">{t.riskLevel}:</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getRiskColor(spot.riskLevel)}`}>
                      {spot.riskLevel}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">{t.riskFactorsTitle}:</span>
                    <div className="flex flex-wrap gap-1">
                      {spot.riskFactors.map((f: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-200 whitespace-nowrap">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200 mb-3">
                    <span className="text-xs font-semibold text-slate-600 block mb-0.5 italic">{t.recommendation}:</span>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{spot.recommendation}"
                    </p>
                  </div>
                  
                  <FeedbackSection 
                    confirmations={spot.confirmations || 0}
                    comments={spot.comments || []}
                    onConfirm={() => {
                      onUpdateSpot(spot.originalIndex, {
                        ...spot,
                        confirmations: (spot.confirmations || 0) + 1
                      });
                    }}
                    onAddComment={(text: string) => {
                      onUpdateSpot(spot.originalIndex, {
                        ...spot,
                        comments: [...(spot.comments || []), { text, timestamp: Date.now() }]
                      });
                    }}
                    locale={locale}
                  />
                </div>
              )}
            </div>
          )}
        </Popup>
      </Marker>
    </React.Fragment>
  );
});

const AccidentMarker = React.memo(({ 
  acc, 
  onUpdateAccident, 
  onDeleteAccident, 
  setDeleteConfirmAccident,
  onRequestDetailedReport,
  onHideUi,
  locale, 
  t 
}: any) => {
  const [isMinimized, setIsMinimized] = useState(false);
  return (
    <Marker
      position={[acc.latitude, acc.longitude]}
      icon={getCachedIcon('#ef4444', true)}
      draggable={true}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: () => {
          if (window.innerWidth < 768) {
            onHideUi();
          }
        },
        dragend: (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          onUpdateAccident(acc.originalIndex, { ...acc, latitude: position.lat, longitude: position.lng });
        },
      }}
    >
      <Popup minWidth={240} autoPanPadding={[20, 20]}>
        <div className="p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-base text-red-600 truncate max-w-[140px]">{t.recentAccident}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-all sm:hidden"
                title={isMinimized ? t.expand : t.minimize}
              >
                {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => setDeleteConfirmAccident(acc.originalIndex)}
                className="p-1.5 text-red-400 hover:bg-red-50 rounded-md transition-all"
                title={t.delete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-sm font-bold text-slate-800 mb-2 leading-tight pr-6">{acc.locationName}</p>
          
          {!isMinimized && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-bold uppercase mb-2 bg-red-50 p-1.5 rounded-md border border-red-100">
                <Move className="w-3 h-3" />
                {t.dragToCorrect}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded shadow-sm uppercase">{acc.severity}</span>
                <span className="text-[10px] text-slate-500 font-medium">{acc.timestamp}</span>
              </div>
              
              <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 mb-3">
                <p className="text-sm text-slate-700 leading-relaxed font-bold mb-1">
                  AI Summary:
                </p>
                <p className="text-xs text-slate-600 leading-relaxed italic mb-3">
                  "{acc.aiSummary || acc.description}"
                </p>
                <div className="bg-white p-2 rounded border border-red-200 shadow-sm">
                  <p className="text-[10px] text-red-600 font-bold uppercase mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    How to Avoid:
                  </p>
                  <p className="text-xs text-slate-800 font-medium leading-tight">
                    {acc.avoidanceTip || (locale === 'en' ? 'Drive with extreme caution and maintain safe speed.' : 'ขับขี่ด้วยความระมัดระวังอย่างยิ่งและรักษาความเร็วที่ปลอดภัย')}
                  </p>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.type}:</span>
                <p className="text-sm text-slate-800">{acc.type}</p>
              </div>

              <FeedbackSection 
                confirmations={acc.confirmations || 0}
                comments={acc.comments || []}
                onConfirm={() => {
                  onUpdateAccident(acc.originalIndex, {
                    ...acc,
                    confirmations: (acc.confirmations || 0) + 1
                  });
                }}
                onAddComment={(text: string) => {
                  onUpdateAccident(acc.originalIndex, {
                    ...acc,
                    comments: [...(acc.comments || []), { text, timestamp: Date.now() }]
                  });
                }}
                locale={locale}
              />

              <button
                onClick={() => onRequestDetailedReport(acc)}
                className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
              >
                <AlertCircle className="w-4 h-4" />
                {locale === 'en' ? 'AI Case Detail' : 'รายละเอียดย้อนหลัง AI'}
              </button>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

const generateCurvePoints = (lat: number, lng: number): [number, number][] => {
  const offset = 0.0008;
  return [
    [lat - offset, lng - offset],
    [lat - offset / 2, lng + offset / 2],
    [lat + offset / 2, lng - offset / 2],
    [lat + offset, lng + offset],
  ];
};


interface FeedbackSectionProps {
  confirmations: number;
  comments: { text: string; timestamp: number }[];
  onConfirm: () => void;
  onAddComment: (text: string) => void;
  locale: Locale;
}

const FeedbackSection: React.FC<FeedbackSectionProps> = ({ confirmations, comments, onConfirm, onAddComment, locale }) => {
  const t = translations[locale];
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="mb-2 p-1.5 bg-blue-900/20 border border-blue-800/30 rounded text-[10px] text-blue-300 font-medium flex items-center gap-1.5">
        <Info className="w-3 h-3" />
        {t.helpVerify}
      </div>
      <div className="flex items-center justify-between mb-2">
        <button 
          onClick={onConfirm}
          className="flex items-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-900/40"
        >
          <ThumbsUp className="w-4 h-4" />
          {t.confirmAccuracy} ({confirmations})
        </button>
        <span className="text-[10px] text-white font-medium flex items-center gap-1 bg-white/10 px-2 py-1.5 rounded-md">
          <MessageSquare className="w-3.5 h-3.5" />
          {comments.length} {t.feedback}
        </span>
      </div>

      <div className="space-y-2 max-h-32 overflow-y-auto mb-2 pr-1 custom-scrollbar">
        {comments.length === 0 ? (
          <p className="text-[10px] text-white/80 italic text-center py-2">{t.noFeedback}</p>
        ) : (
          comments.map((c, i) => (
            <div key={i} className="bg-white/10 p-2 rounded text-[11px] text-white border border-white/20 shadow-sm">
              {c.text}
              <div className="text-[9px] text-white/70 mt-1 font-medium">
                {new Date(c.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-1">
        <input 
          type="text" 
          placeholder={t.addFeedbackPlaceholder}
          className="flex-1 text-[11px] px-2 py-1 bg-white/10 border border-white/20 rounded outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder:text-white/60"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button 
          type="submit"
          disabled={!newComment.trim()}
          className="p-1 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

interface MapComponentProps {
  blackSpots: BlackSpot[];
  recentAccidents: Accident[];
  onUpdateSpot: (index: number, updatedSpot: BlackSpot) => void;
  onUpdateAccident: (index: number, updatedAccident: Accident) => void;
  onDeleteSpot: (index: number) => void;
  onDeleteAccident: (index: number) => void;
  onAddSpot: (newSpot: BlackSpot) => void;
  isAnalysisActive: boolean;
  selectedPoint: { lat: number, lng: number } | null;
  locale: Locale;
  onRequestDetailedReport: (accident: Accident) => void;
  journeyPlan?: JourneySafetyReport | null;
}

// Sub-component to handle map animations and view updates
const MapController: React.FC<{ 
  selectedPoint: { lat: number, lng: number } | null;
  blackSpots: BlackSpot[];
  recentAccidents: Accident[];
  journeyPlan?: JourneySafetyReport | null;
}> = ({ selectedPoint, blackSpots, recentAccidents, journeyPlan }) => {
  const map = useMap();

  // Handle flyTo when a point is selected from sidebar
  useEffect(() => {
    if (selectedPoint) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], 16, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [selectedPoint, map]);

  // Automatically fit bounds when data changes
  useEffect(() => {
    if (blackSpots.length > 0 || recentAccidents.length > 0 || journeyPlan?.hazardsOnRoute?.length) {
      const points: [number, number][] = [
        ...blackSpots.map(s => [s.latitude, s.longitude] as [number, number]),
        ...recentAccidents.map(a => [a.latitude, a.longitude] as [number, number]),
        ...(journeyPlan?.hazardsOnRoute?.map(h => [h.lat, h.lng] as [number, number]) || [])
      ];
      
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [blackSpots, recentAccidents, journeyPlan, map]);

  return null;
};

const MapClickHandler: React.FC<{ 
  onAddSpot: (latlng: L.LatLng) => void, 
  isAddMode: boolean, 
  setIsAddMode: (v: boolean) => void,
  onSetUserLocation: (latlng: L.LatLng) => void,
  isSimulateMode: boolean,
  onToggleUi: () => void,
  onHideUi: () => void,
  isUiHidden: boolean
}> = ({ onAddSpot, isAddMode, setIsAddMode, onSetUserLocation, isSimulateMode, onToggleUi, onHideUi, isUiHidden }) => {
  useMapEvents({
    click(e) {
      // Check if original event target is the map container itself or a tile
      const target = e.originalEvent.target as HTMLElement;
      const isMapBackground = target.classList.contains('leaflet-container') || 
                             target.classList.contains('leaflet-tile') ||
                             target.classList.contains('leaflet-pane');
      
      if (!isMapBackground) return;

      if (isAddMode) {
        onAddSpot(e.latlng);
        setIsAddMode(false);
      } else if (isSimulateMode) {
        onSetUserLocation(e.latlng);
      } else {
        onToggleUi();
      }
    },
    dragstart() {
      if (window.innerWidth < 768 && !isUiHidden) {
        onHideUi(); 
      }
    },
    zoomstart() {
      if (window.innerWidth < 768 && !isUiHidden) {
        onHideUi();
      }
    }
  });
  return null;
};

export const MapComponent: React.FC<MapComponentProps> = ({ 
  blackSpots, 
  recentAccidents = [], 
  onUpdateSpot, 
  onUpdateAccident,
  onDeleteSpot,
  onDeleteAccident,
  onAddSpot, 
  isAnalysisActive,
  selectedPoint,
  locale,
  onRequestDetailedReport,
  journeyPlan
}) => {
  const t = translations[locale];
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Default to Bangkok
  const [isAddMode, setIsAddMode] = useState(false);
  const [isSimulateMode, setIsSimulateMode] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [deleteConfirmSpot, setDeleteConfirmSpot] = useState<number | null>(null);
  const [deleteConfirmAccident, setDeleteConfirmAccident] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<L.LatLng | null>(null);
  const [activeAlert, setActiveAlert] = useState<Accident | BlackSpot | null>(null);
  const [editingSpotIndex, setEditingSpotIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BlackSpot | null>(null);
  const [isUiHidden, setIsUiHidden] = useState(false);

  // Memoize filtered lists to prevent unnecessary re-calculations on every render
  const filteredBlackSpots = React.useMemo(() => {
    const withIndices = blackSpots.map((spot, originalIndex) => ({ ...spot, originalIndex }));
    return filterType 
      ? withIndices.filter(spot => 
          spot.riskLevel === filterType || 
          spot.riskFactors.some(f => f.toLowerCase().includes(filterType.toLowerCase())) ||
          (filterType === 'Poor Lighting' && spot.riskFactors.some(f => f.toLowerCase().includes('light') || f.toLowerCase().includes('dark') || f.toLowerCase().includes('visibility'))) ||
          (filterType === 'Sharp Curve' && spot.riskFactors.some(f => f.toLowerCase().includes('curve') || f.toLowerCase().includes('winding') || f.toLowerCase().includes('bend'))) ||
          (filterType === 'Construction' && spot.riskFactors.some(f => f.toLowerCase().includes('construction') || f.toLowerCase().includes('work'))) ||
          (filterType === 'Flooding' && spot.riskFactors.some(f => f.toLowerCase().includes('flood') || f.toLowerCase().includes('water'))) ||
          (filterType === 'Slippery' && spot.riskFactors.some(f => f.toLowerCase().includes('slippery') || f.toLowerCase().includes('oil') || f.toLowerCase().includes('skid'))) ||
          (filterType === 'Steep' && spot.riskFactors.some(f => f.toLowerCase().includes('steep') || f.toLowerCase().includes('slope') || f.toLowerCase().includes('hill')))
        )
      : withIndices;
  }, [blackSpots, filterType]);

  const filteredAccidents = React.useMemo(() => {
    const withIndices = recentAccidents.map((acc, originalIndex) => ({ ...acc, originalIndex }));
    return filterType === 'Accident' 
      ? withIndices 
      : (filterType ? [] : withIndices);
  }, [recentAccidents, filterType]);

  const startEditing = (index: number, spot: BlackSpot) => {
    setEditingSpotIndex(index);
    setEditForm({ ...spot });
  };

  const handleSaveEdit = () => {
    if (editingSpotIndex !== null && editForm) {
      onUpdateSpot(editingSpotIndex, editForm);
      setEditingSpotIndex(null);
      setEditForm(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingSpotIndex(null);
    setEditForm(null);
  };

  const t_local = t; // For inner components

  // Proximity detection
  useEffect(() => {
    if (!userLocation) return;

    const ALERT_RADIUS = 500; // 500 meters

    // Check accidents first (higher priority)
    const nearbyAccident = recentAccidents.find(acc => {
      const dist = userLocation.distanceTo(L.latLng(acc.latitude, acc.longitude));
      return dist <= ALERT_RADIUS;
    });

    if (nearbyAccident) {
      setActiveAlert(nearbyAccident);
      return;
    }

    // Check black spots
    const nearbyBlackSpot = blackSpots.find(spot => {
      const dist = userLocation.distanceTo(L.latLng(spot.latitude, spot.longitude));
      return dist <= ALERT_RADIUS && (spot.riskLevel === 'Critical' || spot.riskLevel === 'High');
    });

    if (nearbyBlackSpot) {
      setActiveAlert(nearbyBlackSpot);
    } else {
      setActiveAlert(null);
    }
  }, [userLocation, recentAccidents, blackSpots]);

  const handleAddSpot = (latlng: L.LatLng) => {
    const newSpot: BlackSpot = {
      locationName: 'New High Risk Location',
      latitude: latlng.lat,
      longitude: latlng.lng,
      riskLevel: 'High',
      accidentCount: 0,
      injuryCount: 0,
      fatalityCount: 0,
      riskFactors: ['User added location'],
      recommendation: 'Please investigate this area.'
    };
    onAddSpot(newSpot);
  };

  return (
    <div className="h-full w-full relative z-10 bg-[#050505]">
      <MapContainer
        center={defaultCenter}
        zoom={4}
        style={{ height: '100%', width: '100%', background: '#050505' }}
        className="z-0"
        zoomControl={false}
        scrollWheelZoom={true}
        zoomAnimation={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapClickHandler 
          onAddSpot={handleAddSpot} 
          isAddMode={isAddMode} 
          setIsAddMode={setIsAddMode}
          onSetUserLocation={setUserLocation}
          isSimulateMode={isSimulateMode}
          onToggleUi={() => setIsUiHidden(prev => !prev)}
          onHideUi={() => setIsUiHidden(true)}
          isUiHidden={isUiHidden}
        />
        
        {/* User Location Marker */}
        {userLocation && (
          <Marker 
            position={userLocation} 
            icon={L.divIcon({
              className: 'user-location',
              html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          />
        )}

        {/* Black Spots */}
        {filteredBlackSpots.map((spot) => (
          <RiskSpotMarker
            key={`spot-${spot.originalIndex}`}
            spot={spot}
            onUpdateSpot={onUpdateSpot}
            onDeleteSpot={onDeleteSpot}
            startEditing={startEditing}
            editingSpotIndex={editingSpotIndex}
            editForm={editForm}
            handleSaveEdit={handleSaveEdit}
            handleCancelEdit={handleCancelEdit}
            setEditForm={setEditForm}
            setDeleteConfirmSpot={setDeleteConfirmSpot}
            onHideUi={() => setIsUiHidden(true)}
            locale={locale}
            t={t}
          />
        ))}

        {/* Recent Accidents */}
        {filteredAccidents.map((acc) => (
          <AccidentMarker
            key={`acc-${acc.originalIndex}`}
            acc={acc}
            onUpdateAccident={onUpdateAccident}
            onDeleteAccident={onDeleteAccident}
            setDeleteConfirmAccident={setDeleteConfirmAccident}
            onRequestDetailedReport={onRequestDetailedReport}
            onHideUi={() => setIsUiHidden(true)}
            locale={locale}
            t={t}
          />
        ))}

        {/* Journey Hazards */}
        {journeyPlan && journeyPlan.hazardsOnRoute.map((hazard, idx) => (
          <Marker 
            key={`hazard-${idx}`}
            position={[hazard.lat, hazard.lng]} 
            icon={getCachedIcon('#9333ea', true)} // Purple for journey hazards
          >
            <Popup minWidth={280} className="custom-popup" autoPanPadding={[20, 20]}>
              <div className="p-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">{hazard.location}</h3>
                    <div className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase inline-block">
                      {hazard.hazardType}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{hazard.description}</p>
                <div className="bg-purple-50 p-2 rounded border border-purple-100">
                  <div className="flex items-center gap-1.5 text-purple-700 text-xs font-bold uppercase mb-1">
                    <Route className="w-3.5 h-3.5" />
                    Journey Impact
                  </div>
                  <p className="text-xs text-purple-600 italic">Identified for your path from {journeyPlan.origin} to {journeyPlan.destination}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapController 
          selectedPoint={selectedPoint} 
          blackSpots={blackSpots} 
          recentAccidents={recentAccidents || []}
          journeyPlan={journeyPlan}
        />
      </MapContainer>

      {/* Proximity Alert Notification */}
      {activeAlert && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-md animate-bounce transition-all duration-300 ${isUiHidden ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}>
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-2xl flex items-center gap-4 border-2 border-white">
            <div className="bg-white p-2 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg leading-tight">{locale === 'en' ? 'Accident Ahead: Drive with Caution' : 'มีอุบัติเหตุข้างหน้า: โปรดขับรถด้วยความระมัดระวัง'}</h4>
              <p className="text-sm opacity-90">{locale === 'en' ? 'Approaching' : 'กำลังเข้าสู่'} {activeAlert.locationName}</p>
            </div>
            <button 
              onClick={() => setActiveAlert(null)}
              className="p-1 hover:bg-red-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Restore Controls Button (Mobile Only) */}
      <div className={`md:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000] transition-all duration-500 scale-100 ${!isUiHidden ? 'opacity-0 pointer-events-none translate-y-10 scale-90' : 'opacity-100'}`}>
        <button 
          onClick={() => setIsUiHidden(false)}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full shadow-2xl font-bold flex items-center gap-2 border-2 border-blue-400/50 animate-pulse active:scale-95"
        >
          <Info className="w-4 h-4" />
          {locale === 'en' ? 'Show Controls' : 'แสดงเครื่องมือ'}
        </button>
      </div>

      {isAnalysisActive && (
        <div className={`absolute top-4 right-4 z-[1000] flex flex-col gap-2 transition-all duration-300 print:hidden ${isUiHidden ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100'}`}>
          <button
            onClick={() => {
              setIsAddMode(!isAddMode);
              setIsSimulateMode(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg font-bold transition-all active:scale-95 border ${
              isAddMode 
                ? 'bg-blue-600 text-white border-blue-500' 
                : 'bg-white/90 backdrop-blur-md text-slate-800 border-slate-200 hover:bg-white'
            }`}
          >
            <PlusCircle className={`w-5 h-5 ${isAddMode ? 'text-white' : 'text-blue-600'}`} />
            <span className="hidden sm:inline font-bold tracking-tight">{isAddMode ? (locale === 'en' ? 'Click on map' : 'คลิกบนแผนที่') : (locale === 'en' ? 'Add Risk' : 'เพิ่มจุดเสี่ยง')}</span>
          </button>
          
          <button
            onClick={() => {
              setIsSimulateMode(!isSimulateMode);
              setIsAddMode(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg font-bold transition-all active:scale-95 border ${
              isSimulateMode 
                ? 'bg-blue-600 text-white border-blue-500' 
                : 'bg-white/90 backdrop-blur-md text-slate-800 border-slate-200 hover:bg-white'
            }`}
          >
            <Navigation className={`w-5 h-5 ${isSimulateMode ? 'text-white' : 'text-blue-600'}`} />
            <span className="hidden sm:inline font-bold tracking-tight">{isSimulateMode ? (locale === 'en' ? 'Click map' : 'คลิกแผนที่') : (locale === 'en' ? 'Simulate' : 'จำลอง')}</span>
          </button>
        </div>
      )}

      {/* Legend */}
      <div className={`absolute bottom-20 md:bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 transition-all duration-300 print:hidden max-w-[240px] ${isUiHidden ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.mapLegend}</h5>
          </div>
          {filterType && (
            <button 
              onClick={() => setFilterType(null)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {t.clearFilter}
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <button 
            onClick={() => setFilterType(filterType === 'Accident' ? null : 'Accident')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Accident' ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">!</div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Accident' ? 'text-red-700' : 'text-slate-700'}`}>{t.recentAccident}</span>
              {filterType === 'Accident' && <span className="text-[9px] text-red-500/70 leading-tight">{locale === 'en' ? 'Recent crashes' : 'รายงานการชนล่าสุด'}</span>}
            </div>
          </button>
          
          <button 
            onClick={() => setFilterType(filterType === 'Critical' ? null : 'Critical')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Critical' ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Critical' ? 'text-red-700' : 'text-slate-700'}`}>{locale === 'en' ? 'Critical' : 'จุดเสี่ยงวีกฤต'}</span>
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'High' ? null : 'High')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'High' ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'High' ? 'text-orange-700' : 'text-slate-700'}`}>{locale === 'en' ? 'High Risk' : 'เขตความเสี่ยงสูง'}</span>
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Poor Lighting' ? null : 'Poor Lighting')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Poor Lighting' ? 'bg-yellow-50 ring-1 ring-yellow-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border border-dashed border-yellow-600 bg-yellow-100 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Poor Lighting' ? 'text-yellow-700' : 'text-slate-700'}`}>{locale === 'en' ? 'Lighting' : 'แสงสว่างไม่พอ'}</span>
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Sharp Curve' ? null : 'Sharp Curve')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Sharp Curve' ? 'bg-slate-100 ring-1 ring-slate-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-0.5 bg-slate-400"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Sharp Curve' ? 'text-slate-700' : 'text-slate-700'}`}>{locale === 'en' ? 'Sharp Curve' : 'ทางโค้งอันตราย'}</span>
              {filterType === 'Sharp Curve' && <span className="text-[9px] text-slate-500 leading-tight">{locale === 'en' ? 'Dangerous bends' : 'ทางโค้งที่อันตราย'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Construction' ? null : 'Construction')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Construction' ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border-2 border-orange-500 bg-orange-100 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Construction' ? 'text-orange-700' : 'text-slate-700'}`}>{locale === 'en' ? 'Construction' : 'เขตก่อสร้าง'}</span>
              {filterType === 'Construction' && <span className="text-[9px] text-orange-500 leading-tight">{locale === 'en' ? 'Active roadwork' : 'มีการก่อสร้างถนน'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Slippery' ? null : 'Slippery')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Slippery' ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border border-dashed border-indigo-500 bg-indigo-50 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Slippery' ? 'text-indigo-700' : 'text-slate-700'}`}>{locale === 'en' ? 'Slippery Road' : 'ถนนลื่น'}</span>
              {filterType === 'Slippery' && <span className="text-[9px] text-indigo-500 leading-tight">{locale === 'en' ? 'Skid hazards' : 'อันตรายจากการลื่นไถล'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Steep' ? null : 'Steep')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Steep' ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border border-dashed border-purple-500 bg-purple-50 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Steep' ? 'text-purple-700' : 'text-slate-700'}`}>{locale === 'en' ? 'Steep Slope' : 'ทางลาดชัน'}</span>
              {filterType === 'Steep' && <span className="text-[9px] text-purple-500 leading-tight">{locale === 'en' ? 'Danger inclines' : 'ทางลาดหรือทางชัน'}</span>}
            </div>
          </button>
        </div>
      </div>

      {/* Custom Delete Confirmation Modals */}
      {(deleteConfirmSpot !== null || deleteConfirmAccident !== null) && (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white w-full max-w-xs rounded-xl shadow-2xl p-5 border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900">{locale === 'en' ? 'Remove Record?' : 'ลบบันทึก?'}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              {locale === 'en' ? 'Are you sure you want to remove this record? This change will be shared with all users.' : 'คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกนี้? การเปลี่ยนแปลงนี้จะถูกแชร์กับผู้ใช้ทุกคน'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirmSpot(null);
                  setDeleteConfirmAccident(null);
                }}
                className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmSpot !== null) {
                    onDeleteSpot(deleteConfirmSpot);
                    setEditingSpotIndex(null);
                    setEditForm(null);
                  } else if (deleteConfirmAccident !== null) {
                    onDeleteAccident(deleteConfirmAccident);
                  }
                  setDeleteConfirmSpot(null);
                  setDeleteConfirmAccident(null);
                }}
                className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
