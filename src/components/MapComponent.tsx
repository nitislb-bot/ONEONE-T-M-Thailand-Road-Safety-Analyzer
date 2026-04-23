import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { BlackSpot, Accident } from '../services/geminiService';
import { PlusCircle, AlertCircle, MapPin, Navigation, Info, X, Edit2, Save, Trash2, AlertTriangle, Move, MessageSquare, ThumbsUp, Send } from 'lucide-react';

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

const createCustomIcon = (color: string, isAccident = false) => {
  const size = isAccident ? 32 : 24;
  const innerSize = isAccident ? 24 : 18;
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
      ${isAccident ? '<span style="color: white; font-weight: bold; font-size: 16px; line-height: 1;">!</span>' : ''}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

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
          className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:bg-blue-900/30 px-2 py-1 rounded transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          {t.confirmAccuracy} ({confirmations})
        </button>
        <span className="text-[10px] text-white font-medium flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
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
}

// Sub-component to handle map animations and view updates
const MapController: React.FC<{ 
  selectedPoint: { lat: number, lng: number } | null;
  blackSpots: BlackSpot[];
  recentAccidents: Accident[];
}> = ({ selectedPoint, blackSpots, recentAccidents }) => {
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
    if (blackSpots.length > 0 || recentAccidents.length > 0) {
      const points: [number, number][] = [
        ...blackSpots.map(s => [s.latitude, s.longitude] as [number, number]),
        ...recentAccidents.map(a => [a.latitude, a.longitude] as [number, number])
      ];
      
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [blackSpots, recentAccidents, map]);

  return null;
};

const MapClickHandler: React.FC<{ 
  onAddSpot: (latlng: L.LatLng) => void, 
  isAddMode: boolean, 
  setIsAddMode: (v: boolean) => void,
  onSetUserLocation: (latlng: L.LatLng) => void,
  isSimulateMode: boolean
}> = ({ onAddSpot, isAddMode, setIsAddMode, onSetUserLocation, isSimulateMode }) => {
  useMapEvents({
    click(e) {
      if (isAddMode) {
        onAddSpot(e.latlng);
        setIsAddMode(false);
      } else if (isSimulateMode) {
        onSetUserLocation(e.latlng);
      }
    },
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
  locale
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

  const filteredBlackSpots = blackSpots.map((spot, originalIndex) => ({ ...spot, originalIndex })).filter(({ ...spot }) => {
    if (!filterType) return true;
    if (filterType === 'Accident') return false;
    if (filterType === 'Poor Lighting') return spot.riskFactors.some(f => f.toLowerCase().includes('light') || f.toLowerCase().includes('dark') || f.toLowerCase().includes('visibility'));
    if (filterType === 'Sharp Curve') return spot.riskFactors.some(f => f.toLowerCase().includes('curve') || f.toLowerCase().includes('winding') || f.toLowerCase().includes('bend'));
    if (filterType === 'Construction') return spot.riskFactors.some(f => f.toLowerCase().includes('construction') || f.toLowerCase().includes('work'));
    if (filterType === 'Flooding') return spot.riskFactors.some(f => f.toLowerCase().includes('flood') || f.toLowerCase().includes('water'));
    if (filterType === 'Slippery') return spot.riskFactors.some(f => f.toLowerCase().includes('slippery') || f.toLowerCase().includes('oil') || f.toLowerCase().includes('skid'));
    if (filterType === 'Steep') return spot.riskFactors.some(f => f.toLowerCase().includes('steep') || f.toLowerCase().includes('slope') || f.toLowerCase().includes('hill'));
    return spot.riskLevel === filterType;
  });

  const filteredAccidents = recentAccidents.map((acc, originalIndex) => ({ ...acc, originalIndex })).filter(() => {
    if (!filterType) return true;
    return filterType === 'Accident';
  });

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        zoomControl={false}
        scrollWheelZoom={true}
        zoomAnimation={true}
        markerZoomAnimation={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler 
          onAddSpot={handleAddSpot} 
          isAddMode={isAddMode} 
          setIsAddMode={setIsAddMode}
          onSetUserLocation={setUserLocation}
          isSimulateMode={isSimulateMode}
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
        {filteredBlackSpots.map((spot, index) => {
          const hasPoorLighting = spot.riskFactors.some(f => 
            f.toLowerCase().includes('lighting') || 
            f.toLowerCase().includes('dark') || 
            f.toLowerCase().includes('visibility')
          );
          const hasSharpCurves = spot.riskFactors.some(f => 
            f.toLowerCase().includes('curve') || 
            f.toLowerCase().includes('winding') || 
            f.toLowerCase().includes('bend')
          );
          const hasConstruction = spot.riskFactors.some(f => 
            f.toLowerCase().includes('construction') || 
            f.toLowerCase().includes('work')
          );
          const hasFlooding = spot.riskFactors.some(f => 
            f.toLowerCase().includes('flood') || 
            f.toLowerCase().includes('water')
          );
          const hasSlippery = spot.riskFactors.some(f => 
            f.toLowerCase().includes('slippery') || 
            f.toLowerCase().includes('oil') ||
            f.toLowerCase().includes('skid')
          );
          const hasSteep = spot.riskFactors.some(f => 
            f.toLowerCase().includes('steep') || 
            f.toLowerCase().includes('slope') ||
            f.toLowerCase().includes('hill')
          );

          return (
            <React.Fragment key={`spot-group-${index}`}>
              {hasPoorLighting && (
                <Circle
                  center={[spot.latitude, spot.longitude]}
                  radius={150}
                  pathOptions={{ 
                    fillColor: '#fde047', 
                    fillOpacity: 0.25, 
                    color: '#eab308', 
                    weight: 1,
                    dashArray: '5, 5'
                  }}
                />
              )}
              {hasSharpCurves && (
                <Polyline
                  positions={generateCurvePoints(spot.latitude, spot.longitude)}
                  pathOptions={{ 
                    color: '#4b5563', 
                    weight: 3, 
                    opacity: 0.8,
                    lineCap: 'round'
                  }}
                />
              )}
              {hasConstruction && (
                <Circle
                  center={[spot.latitude, spot.longitude]}
                  radius={100}
                  pathOptions={{ 
                    fillColor: '#f97316', 
                    fillOpacity: 0.4, 
                    color: '#ea580c', 
                    weight: 2,
                    dashArray: '10, 5'
                  }}
                />
              )}
              {hasFlooding && (
                <Circle
                  center={[spot.latitude, spot.longitude]}
                  radius={200}
                  pathOptions={{ 
                    fillColor: '#3b82f6', 
                    fillOpacity: 0.2, 
                    color: '#2563eb', 
                    weight: 1,
                    dashArray: '10, 10'
                  }}
                />
              )}
              {hasSlippery && (
                <Circle
                  center={[spot.latitude, spot.longitude]}
                  radius={120}
                  pathOptions={{ 
                    fillColor: '#6366f1', 
                    fillOpacity: 0.3, 
                    color: '#4f46e5', 
                    weight: 1,
                    dashArray: '2, 4'
                  }}
                />
              )}
              {hasSteep && (
                <Circle
                  center={[spot.latitude, spot.longitude]}
                  radius={180}
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
                icon={createCustomIcon(getMarkerColor(spot.riskLevel))}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    onUpdateSpot(spot.originalIndex, { ...spot, latitude: position.lat, longitude: position.lng });
                  },
                }}
              >
                <Popup>
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
                      
                      <div className="space-y-3">
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
                          <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded bg-gray-50">
                            {editForm.riskFactors.map((factor, i) => (
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
                                    const newFactors = editForm.riskFactors.filter((_, idx) => idx !== i);
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
                    <div className="p-2 max-w-xs">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-lg leading-tight text-white">{spot.locationName}</h3>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => startEditing(spot.originalIndex, spot)}
                            className="p-1 hover:bg-white/10 rounded text-blue-400 transition-colors"
                            title={t.editLocation}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmSpot(spot.originalIndex)}
                            className="p-1 hover:bg-red-900/20 rounded text-red-400 transition-colors"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-white/90">{t.riskLevel}:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white`} style={{ backgroundColor: getMarkerColor(spot.riskLevel) }}>
                          {spot.riskLevel}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-300 font-bold uppercase mb-2 bg-blue-900/20 p-1 rounded">
                        <Move className="w-3 h-3" />
                        {t.dragToCorrect}
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                        <div className="bg-white/10 p-1 rounded">
                          <div className="text-xs text-white/60">{t.accidents}</div>
                          <div className="font-bold text-white">{spot.accidentCount}</div>
                        </div>
                        <div className="bg-orange-900/20 p-1 rounded">
                          <div className="text-xs text-orange-300">{t.injuries}</div>
                          <div className="font-bold text-white">{spot.injuryCount}</div>
                        </div>
                        <div className="bg-red-900/20 p-1 rounded">
                          <div className="text-xs text-red-300">{t.fatalities}</div>
                          <div className="font-bold text-white">{spot.fatalityCount}</div>
                        </div>
                      </div>
                      <div className="mb-2">
                        <span className="text-sm font-semibold text-white/90">{t.riskFactorsTitle}:</span>
                        <ul className="list-disc list-inside text-sm text-white mt-1">
                          {spot.riskFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                        </ul>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-white/90">{t.recommendation}:</span>
                        <p className="text-sm text-white mt-1">{spot.recommendation}</p>
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
                        onAddComment={(text) => {
                          onUpdateSpot(spot.originalIndex, {
                            ...spot,
                            comments: [...(spot.comments || []), { text, timestamp: Date.now() }]
                          });
                        }}
                        locale={locale}
                      />
                    </div>
                  )}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Recent Accidents */}
        {filteredAccidents.map((acc, index) => (
          <Marker
            key={`acc-${index}`}
            position={[acc.latitude, acc.longitude]}
            icon={createCustomIcon('#ef4444', true)}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onUpdateAccident(acc.originalIndex, { ...acc, latitude: position.lat, longitude: position.lng });
              },
            }}
          >
            <Popup>
              <div className="p-2 max-w-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h3 className="font-bold text-lg text-red-400">{t.recentAccident}</h3>
                  </div>
                  <button 
                    onClick={() => setDeleteConfirmAccident(acc.originalIndex)}
                    className="p-1 text-white/40 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-all"
                    title={t.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-white mb-1">{acc.locationName}</p>
                
                <div className="flex items-center gap-1.5 text-[10px] text-red-300 font-bold uppercase mb-2 bg-red-900/20 p-1 rounded">
                  <Move className="w-3 h-3" />
                  {t.dragToCorrect}
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-red-900/40 text-red-200 rounded uppercase">{acc.severity}</span>
                  <span className="text-xs text-white/60">{acc.timestamp}</span>
                </div>
                <p className="text-sm text-white bg-white/5 p-2 rounded border border-white/10 italic">
                  "{acc.description}"
                </p>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{t.type}:</span>
                  <p className="text-sm text-white">{acc.type}</p>
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
                  onAddComment={(text) => {
                    onUpdateAccident(acc.originalIndex, {
                      ...acc,
                      comments: [...(acc.comments || []), { text, timestamp: Date.now() }]
                    });
                  }}
                  locale={locale}
                />
              </div>
            </Popup>
          </Marker>
        ))}

        <MapController 
          selectedPoint={selectedPoint} 
          blackSpots={blackSpots} 
          recentAccidents={recentAccidents} 
        />
      </MapContainer>

      {/* Proximity Alert Notification */}
      {activeAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-md animate-bounce">
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

      {isAnalysisActive && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 print:hidden">
          <button
            onClick={() => {
              setIsAddMode(!isAddMode);
              setIsSimulateMode(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-md font-medium transition-colors ${
              isAddMode 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border border-white/10'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            {isAddMode ? (locale === 'en' ? 'Click on map to add spot' : 'คลิกบนแผนที่เพื่อเพิ่มจุด') : (locale === 'en' ? 'Add Risk Spot' : 'เพิ่มจุดเสี่ยง')}
          </button>
          
          <button
            onClick={() => {
              setIsSimulateMode(!isSimulateMode);
              setIsAddMode(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md shadow-md font-medium transition-colors ${
              isSimulateMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border border-white/10'
            }`}
          >
            <Navigation className="w-5 h-5" />
            {isSimulateMode ? (locale === 'en' ? 'Click map to simulate' : 'คลิกแผนที่เพื่อจำลองตำแหน่ง') : (locale === 'en' ? 'Simulate Proximity' : 'จำลองความใกล้ชิด')}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-[1000] glass-dark p-4 rounded-xl shadow-2xl border border-white/10 print:hidden max-w-[240px]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-white/50" />
            <h5 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{t.mapLegend}</h5>
          </div>
          {filterType && (
            <button 
              onClick={() => setFilterType(null)}
              className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              {t.clearFilter}
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <button 
            onClick={() => setFilterType(filterType === 'Accident' ? null : 'Accident')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Accident' ? 'bg-red-500/20 ring-1 ring-red-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center text-[8px] text-white font-bold shadow-sm shadow-red-900/40">!</div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{t.recentAccident}</span>
              {filterType === 'Accident' && <span className="text-[9px] text-red-300/70 leading-tight">{locale === 'en' ? 'Showing only recent crash reports' : 'แสดงเฉพาะรายงานการชนล่าสุด'}</span>}
            </div>
          </button>
          
          <button 
            onClick={() => setFilterType(filterType === 'Critical' ? null : 'Critical')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Critical' ? 'bg-red-500/20 ring-1 ring-red-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-sm shadow-red-900/40"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'Critical Risk Spot' : 'จุดเสี่ยงวิกฤต'}</span>
              {filterType === 'Critical' && <span className="text-[9px] text-red-300/70 leading-tight">{locale === 'en' ? 'Highest priority safety hazards' : 'อันตรายด้านความปลอดภัยที่มีความสำคัญสูงสุด'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'High' ? null : 'High')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'High' ? 'bg-orange-500/20 ring-1 ring-orange-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 shadow-sm shadow-orange-900/40"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'High Risk Zone' : 'เขตความเสี่ยงสูง'}</span>
              {filterType === 'High' && <span className="text-[9px] text-orange-300/70 leading-tight">{locale === 'en' ? 'Significant safety concerns' : 'ข้อกังวลด้านความปลอดภัยที่สำคัญ'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Poor Lighting' ? null : 'Poor Lighting')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Poor Lighting' ? 'bg-yellow-500/20 ring-1 ring-yellow-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-4 h-4 border border-dashed border-yellow-500 bg-yellow-500/20 rounded-full"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'Poor Lighting' : 'แสงสว่างไม่เพียงพอ'}</span>
              {filterType === 'Poor Lighting' && <span className="text-[9px] text-yellow-300/70 leading-tight">{locale === 'en' ? 'Areas with low visibility at night' : 'บริเวณที่ทัศนวิสัยต่ำในเวลากลางคืน'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Sharp Curve' ? null : 'Sharp Curve')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Sharp Curve' ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'}`}
          >
            <div className="w-4 h-0.5 bg-white/60"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'Sharp Curve' : 'ทางโค้งอันตราย'}</span>
              {filterType === 'Sharp Curve' && <span className="text-[9px] text-white/50 leading-tight">{locale === 'en' ? 'Dangerous bends or winding roads' : 'ทางโค้งที่อันตรายหรือถนนที่คดเคี้ยว'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Construction' ? null : 'Construction')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Construction' ? 'bg-orange-500/20 ring-1 ring-orange-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-4 h-4 border-2 border-orange-500 bg-orange-500/20 rounded-full"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'Construction' : 'เขตก่อสร้าง'}</span>
              {filterType === 'Construction' && <span className="text-[9px] text-orange-300/70 leading-tight">{locale === 'en' ? 'Active roadwork or hazards' : 'มีการก่อสร้างถนนหรืออันตราย'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Slippery' ? null : 'Slippery')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Slippery' ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-4 h-4 border border-dashed border-indigo-500 bg-indigo-500/20 rounded-full"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'Slippery Road' : 'ถนนลื่น'}</span>
              {filterType === 'Slippery' && <span className="text-[9px] text-indigo-300/70 leading-tight">{locale === 'en' ? 'Oil, water, or skid hazards' : 'น้ำมัน น้ำ หรืออันตรายจากการลื่นไถล'}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Steep' ? null : 'Steep')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Steep' ? 'bg-purple-500/20 ring-1 ring-purple-500/50' : 'hover:bg-white/5'}`}
          >
            <div className="w-4 h-4 border border-dashed border-purple-500 bg-purple-500/20 rounded-full"></div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/90 font-medium">{locale === 'en' ? 'Steep Slope' : 'ทางลาดชัน'}</span>
              {filterType === 'Steep' && <span className="text-[9px] text-purple-300/70 leading-tight">{locale === 'en' ? 'Dangerous inclines or declines' : 'ทางลาดหรือทางชันที่อันตราย'}</span>}
            </div>
          </button>
        </div>
      </div>

      {/* Custom Delete Confirmation Modals */}
      {(deleteConfirmSpot !== null || deleteConfirmAccident !== null) && (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="bg-[#0f0f0f] w-full max-w-xs rounded-xl shadow-2xl p-5 border border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-500 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-white">{locale === 'en' ? 'Remove Record?' : 'ลบบันทึก?'}</h3>
            </div>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              {locale === 'en' ? 'Are you sure you want to remove this record? This change will be shared with all users.' : 'คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกนี้? การเปลี่ยนแปลงนี้จะถูกแชร์กับผู้ใช้ทุกคน'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeleteConfirmSpot(null);
                  setDeleteConfirmAccident(null);
                }}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
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
                className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
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
