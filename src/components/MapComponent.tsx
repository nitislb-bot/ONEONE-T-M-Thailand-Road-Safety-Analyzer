import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { BlackSpot, Accident, JourneySafetyReport, DriverCoachingReport, RiskSpot } from '../services/geminiService';
import { PlusCircle, AlertCircle, MapPin, Navigation, Info, X, Edit2, Save, Trash2, AlertTriangle, Move, MessageSquare, ThumbsUp, Send, ChevronDown, ChevronUp, Route, Wind, RefreshCw, Skull, User, GraduationCap, ShieldCheck, CheckSquare, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

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
    case 'Critical': 
    case 'วิกฤต': return '#ef4444'; // red-500
    case 'High': 
    case 'สูง': return '#f97316'; // orange-500
    case 'Medium': 
    case 'ปานกลาง': return '#eab308'; // yellow-500
    case 'Low': 
    case 'ต่ำ': return '#22c55e'; // green-500
    default: return '#3b82f6'; // blue-500
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'Critical': 
    case 'วิกฤต': return 'bg-red-900/40 text-red-200 border-red-500/50';
    case 'High': 
    case 'สูง': return 'bg-orange-900/40 text-orange-200 border-orange-500/50';
    case 'Medium': 
    case 'ปานกลาง': return 'bg-yellow-900/40 text-yellow-200 border-yellow-500/50';
    case 'Low': 
    case 'ต่ำ': return 'bg-green-900/40 text-green-200 border-green-500/50';
    default: return 'bg-blue-900/40 text-blue-200 border-blue-500/50';
  }
};

const iconCache: Record<string, L.DivIcon> = {};
const getCachedIcon = (color: string, isAccident = false, isSelected = false) => {
  const isMobile = window.innerWidth < 768;
  const key = `${color}-${isAccident}-${isSelected}-${isMobile}`;
  if (!iconCache[key]) {
    // Even larger touch targets for mobile (at least 44px)
    const baseSize = isAccident ? 32 : 24;
    const size = isMobile ? baseSize * 1.6 : baseSize;
    // Increase hit area significantly with transparent padding
    const hitAreaSize = size + (isMobile ? 32 : 12);
    
    // Add pulse effect for critical spots or accidents if selected
    const pulseAnim = (isSelected || (color === '#ef4444' && isMobile)) 
      ? 'animation: marker-pulse 2s infinite;' 
      : '';
    
    iconCache[key] = L.divIcon({
      className: 'custom-icon',
      html: `<div style="width: ${hitAreaSize}px; height: ${hitAreaSize}px; display: flex; align-items: center; justify-content: center; background: transparent;">
        <div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: ${isSelected ? '4px' : (isMobile ? '3px' : '2px')} solid ${isSelected ? '#3b82f6' : (isMobile ? '#1e293b' : 'white')}; box-shadow: ${isSelected ? '0 0 20px rgba(59, 130, 246, 0.6)' : '0 4px 12px rgba(0,0,0,0.3)'}; display: flex; align-items: center; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); ${pulseAnim}">
          ${isAccident ? `<span style="color: white; font-weight: bold; font-size: ${isMobile ? '24px' : '16px'}; line-height: 1;">!</span>` : ''}
          ${isSelected ? `<div style="position: absolute; top: -8px; right: -8px; width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>` : ''}
        </div>
      </div>`,
      iconSize: [hitAreaSize, hitAreaSize],
      iconAnchor: [hitAreaSize / 2, hitAreaSize / 2],
      popupAnchor: [0, -hitAreaSize / 2],
    });
  }
  return iconCache[key];
};

const SeverityTrendChart = React.memo(({ data, t }: { data: { year: number, severity: number }[], t: any }) => {
  return (
    <div className="h-28 w-full mt-2 bg-slate-50/50 rounded-lg p-1 border border-slate-100">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1 px-1">
        <BarChart3 className="w-2.5 h-2.5" />
        {t.severityTrend || 'Severity Trend (%)'}
      </p>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSeverity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="year" 
            fontSize={8} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis 
            fontSize={8} 
            tickLine={false} 
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: '#94a3b8' }}
          />
          <RechartsTooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '9px', color: 'white' }}
            itemStyle={{ color: '#fca5a5' }}
          />
          <Area 
            type="monotone" 
            dataKey="severity" 
            stroke="#ef4444" 
            fillOpacity={1} 
            fill="url(#colorSeverity)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

const CoachingSpotMarker = React.memo(({ 
  spot, 
  onHideUi,
  activePoint,
  setActivePoint,
  t 
}: any) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const isSelected = activePoint?.latitude === spot.latitude && activePoint?.longitude === spot.longitude && activePoint?.hazardType !== undefined;
  
  if (spot.latitude == null || isNaN(spot.latitude) || spot.longitude == null || isNaN(spot.longitude)) {
    return null;
  }

  return (
    <Marker
      position={[spot.latitude, spot.longitude]}
      icon={getCachedIcon('#4f46e5', false, isSelected)} // Indigo color for coaching spots
      eventHandlers={{
        click: (e) => {
          setActivePoint(spot);
          if (window.innerWidth < 768) {
            onHideUi();
          }
        },
      }}
    >
      <Popup minWidth={260} autoPanPadding={[20, 20]}>
        <div className="p-2 max-w-[260px]">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm leading-tight text-slate-800 pr-4 truncate">{spot.locationName}</h3>
            </div>
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-all sm:hidden"
            >
              {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
          
          {!isMinimized && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded uppercase">
                  {spot.hazardType || 'Point of Interest'}
                </span>
              </div>

              {/* Accident Statistics Section */}
              <div className="grid grid-cols-3 gap-2 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">
                <div className="text-center">
                  <div className="text-[9px] font-bold text-red-600 uppercase mb-0.5">{t.accidentCount || 'Accidents'}</div>
                  <div className="flex items-center justify-center gap-1 text-red-700">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-xs font-bold">{spot.accidentCount}</span>
                  </div>
                </div>
                <div className="text-center border-x border-red-200">
                  <div className="text-[9px] font-bold text-orange-600 uppercase mb-0.5">{t.injuryCount || 'Injuries'}</div>
                  <div className="flex items-center justify-center gap-1 text-orange-700">
                    <User className="w-3 h-3" />
                    <span className="text-xs font-bold">{spot.injuryCount}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-bold text-red-800 uppercase mb-0.5">{t.fatalityCount || 'Deaths'}</div>
                  <div className="flex items-center justify-center gap-1 text-red-900">
                    <Skull className="w-3 h-3" />
                    <span className="text-xs font-bold">{spot.fatalityCount}</span>
                  </div>
                </div>
              </div>

              {spot.severityTrend && spot.severityTrend.length > 0 && (
                <SeverityTrendChart data={spot.severityTrend} t={t} />
              )}

              <div className="space-y-3">
                <div className="bg-blue-50 p-2 rounded border border-blue-100">
                  <p className="text-[10px] text-blue-600 font-bold uppercase mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {translations[translations.en === t ? 'en' : 'th'].mitigation || 'Mitigation'}
                  </p>
                  <p className="text-[11px] text-slate-800 leading-tight">
                    {spot.mitigationStrategy}
                  </p>
                </div>
                
                <div className="bg-green-50 p-2 rounded border border-green-100">
                  <p className="text-[10px] text-green-600 font-bold uppercase mb-1 flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" />
                    {translations[translations.en === t ? 'en' : 'th'].prevention || 'Prevention'}
                  </p>
                  <p className="text-[11px] text-slate-800 leading-tight">
                    {spot.preventionAdvice}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

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
  activePoint,
  setActivePoint,
  locale, 
  t 
}: any) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const isSelected = activePoint?.originalIndex === spot.originalIndex && activePoint?.riskLevel !== undefined;
  
  if (spot.latitude == null || isNaN(spot.latitude) || spot.longitude == null || isNaN(spot.longitude)) {
    return null;
  }

  const hasPoorLighting = spot.riskFactors.some((f: string) => 
    f.toLowerCase().includes('lighting') || 
    f.toLowerCase().includes('dark') || 
    f.toLowerCase().includes('visibility') ||
    f.includes('แสงสว่าง') || 
    f.includes('มืด') || 
    f.includes('ทัศนวิสัย')
  );
  const hasSharpCurves = spot.riskFactors.some((f: string) => 
    f.toLowerCase().includes('curve') || 
    f.toLowerCase().includes('winding') || 
    f.toLowerCase().includes('bend') ||
    f.includes('ทางโค้ง') || 
    f.includes('หักศอก') || 
    f.includes('คดเคี้ยว')
  );

  return (
    <React.Fragment>
      {hasSharpCurves && (
        <Polyline 
          positions={generateCurvePoints(spot.latitude, spot.longitude)}
          pathOptions={{ color: '#ef4444', weight: 4, dashArray: '5, 10', opacity: isSelected ? 0.8 : 0.4 }}
        />
      )}
      {hasPoorLighting && (
        <Circle 
          center={[spot.latitude, spot.longitude]} 
          radius={50}
          pathOptions={{ 
            fillColor: '#a855f7', 
            fillOpacity: isSelected ? 0.3 : 0.15, 
            color: '#9333ea', 
            weight: 2,
            dashArray: '15, 5',
            opacity: isSelected ? 0.8 : 0.4
          }}
        />
      )}
      <Marker
        position={[spot.latitude, spot.longitude]}
        icon={getCachedIcon(getMarkerColor(spot.riskLevel), false, isSelected)}
        draggable={true}
        eventHandlers={{
          click: (e) => {
            setActivePoint(spot);
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
        <Popup minWidth={280} autoPanPadding={[20, 20]} className={editingSpotIndex === spot.originalIndex ? "editing-popup" : "viewing-popup"}>
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
                    <option value="Low">{t.low}</option>
                    <option value="Medium">{t.medium}</option>
                    <option value="High">{t.high}</option>
                    <option value="Critical">{t.critical}</option>
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
                          title={t.removeFactor}
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
                      {t.addNewFactor}
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
                      Lat: {editForm.latitude != null && !isNaN(editForm.latitude) ? editForm.latitude.toFixed(6) : 'N/A'}
                    </div>
                    <div className="bg-gray-100 px-2 py-1.5 rounded text-xs text-gray-600 font-mono">
                      Lng: {editForm.longitude != null && !isNaN(editForm.longitude) ? editForm.longitude.toFixed(6) : 'N/A'}
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

                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 text-white rounded shadow-sm uppercase">
                        {spot.riskLevel === 'Critical' ? t.critical : spot.riskLevel === 'High' ? t.high : spot.riskLevel === 'Medium' ? t.medium : t.low} {t.riskLevel || 'Risk'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed font-bold mb-1">
                      {t.aiSummary || 'AI Analysis & Risk Factors'}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {spot.riskFactors.map((f: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-white text-slate-600 rounded border border-blue-200 shadow-sm whitespace-nowrap font-medium">
                          {f}
                        </span>
                      ))}
                    </div>

                    <div className="bg-white p-2 rounded border border-blue-200 shadow-sm">
                      <p className="text-[10px] text-blue-600 font-bold uppercase mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {t.howToAvoid || 'Action for Driver'}
                      </p>
                      <p className="text-xs text-slate-800 font-medium leading-tight">
                        {spot.recommendation}
                      </p>
                    </div>
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
  activePoint,
  setActivePoint,
  locale, 
  t 
}: any) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const isSelected = activePoint?.originalIndex === acc.originalIndex && activePoint?.severity !== undefined;

  if (acc.latitude == null || isNaN(acc.latitude) || acc.longitude == null || isNaN(acc.longitude)) {
    return null;
  }

  return (
    <React.Fragment>
      <Marker
        position={[acc.latitude, acc.longitude]}
        icon={getCachedIcon('#ef4444', true, isSelected)}
        draggable={true}
        eventHandlers={{
          click: (e) => {
            setActivePoint(acc);
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
        {window.innerWidth >= 768 && (
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
                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded shadow-sm uppercase">
                  {acc.severity === 'Fatal' ? t.fatal : acc.severity === 'Major' ? t.major : t.minor}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">{acc.timestamp}</span>
              </div>
              
              <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 mb-3">
                <p className="text-sm text-slate-700 leading-relaxed font-bold mb-1">
                  {t.aiSummary}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed italic mb-3">
                  "{acc.aiSummary || acc.description}"
                </p>
                <div className="bg-white p-2 rounded border border-red-200 shadow-sm">
                  <p className="text-[10px] text-red-600 font-bold uppercase mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t.howToAvoid}
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
                {t.aiCaseDetail}
              </button>
            </div>
          )}
        </div>
      </Popup>
    )}
  </Marker>
    </React.Fragment>
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
  coachingReport?: DriverCoachingReport | null;
  user?: any | null;
}

// Sub-component to handle map animations and view updates
const MapController: React.FC<{ 
  selectedPoint: { lat: number, lng: number } | null;
  blackSpots: BlackSpot[];
  recentAccidents: Accident[];
  journeyPlan?: JourneySafetyReport | null;
  coachingReport?: DriverCoachingReport | null;
  activePoint: any | null;
}> = ({ selectedPoint, blackSpots, recentAccidents, journeyPlan, coachingReport, activePoint }) => {
  const map = useMap();

  // Handle flyTo when a point is selected from sidebar
  useEffect(() => {
    if (selectedPoint && selectedPoint.lat != null && !isNaN(selectedPoint.lat) && selectedPoint.lng != null && !isNaN(selectedPoint.lng)) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], 16, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [selectedPoint, map]);

  // Handle smooth panning to active marker on click
  useEffect(() => {
    let lat: number | null = null;
    let lng: number | null = null;

    if (activePoint) {
      if ('latitude' in activePoint) {
        lat = activePoint.latitude;
        lng = activePoint.longitude;
      } else if ('lat' in activePoint) {
        lat = activePoint.lat;
        lng = activePoint.lng;
      }
    }

    if (lat != null && !isNaN(lat) && lng != null && !isNaN(lng)) {
      const isMobile = window.innerWidth < 768;
      const zoom = map.getZoom();
      
      // Calculate a target center that accounts for the mobile card
      // Shifting the view so the marker is in the top 40% of the screen
      if (isMobile) {
        map.flyTo([lat, lng], Math.max(zoom, 16), {
          duration: 1.2,
          easeLinearity: 0.25
        });
        
        // Wait for fly to finish then pan slightly for better framing
        setTimeout(() => {
          map.panBy([0, -120], { animate: true, duration: 0.5 });
        }, 1200);
      } else {
        map.flyTo([lat, lng], Math.max(zoom, 15), {
          duration: 1.2,
          easeLinearity: 0.25
        });
      }
    }
  }, [activePoint, map]);

  // Automatically fit bounds when data changes
  useEffect(() => {
    if (blackSpots.length > 0 || recentAccidents.length > 0 || journeyPlan?.hazardsOnRoute?.length || coachingReport?.highRiskSpots?.length) {
      const allPoints: (number | null | undefined)[][] = [
        ...blackSpots.map(s => [s.latitude, s.longitude]),
        ...recentAccidents.map(a => [a.latitude, a.longitude]),
        ...(journeyPlan?.hazardsOnRoute?.map(h => [h.lat, h.lng]) || []),
        ...(coachingReport?.highRiskSpots?.map(s => [s.latitude, s.longitude]) || [])
      ];
      
      const validPoints = allPoints.filter(p => p[0] != null && !isNaN(p[0] as number) && p[1] != null && !isNaN(p[1] as number)) as [number, number][];
      
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [blackSpots, recentAccidents, journeyPlan, coachingReport, map]);

  return null;
};

const MapClickHandler: React.FC<{ 
  onSetUserLocation: (latlng: L.LatLng) => void,
  isSimulateMode: boolean,
  onToggleUi: () => void,
  onHideUi: () => void,
  isUiHidden: boolean,
  setActivePoint: (v: any) => void
}> = ({ onSetUserLocation, isSimulateMode, onToggleUi, onHideUi, isUiHidden, setActivePoint }) => {
  useMapEvents({
    click(e) {
      // Check if original event target is the map container itself or a tile
      const target = e.originalEvent.target as HTMLElement;
      const isMapBackground = target.classList.contains('leaflet-container') || 
                             target.classList.contains('leaflet-tile') ||
                             target.classList.contains('leaflet-pane');
      
      if (!isMapBackground) return;

      setActivePoint(null);
      
      if (isSimulateMode) {
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
  journeyPlan,
  coachingReport,
  user // added user prop
}) => {
  const t = translations[locale];
  const defaultCenter: [number, number] = [13.7563, 100.5018]; // Default to Bangkok
  const [isSimulateMode, setIsSimulateMode] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [deleteConfirmSpot, setDeleteConfirmSpot] = useState<number | null>(null);
  const [deleteConfirmAccident, setDeleteConfirmAccident] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<L.LatLng | null>(null);
  const [activeAlert, setActiveAlert] = useState<Accident | BlackSpot | null>(null);
  const [activePoint, setActivePoint] = useState<any | null>(null);
  const [editingSpotIndex, setEditingSpotIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BlackSpot | null>(null);
  const [isUiHidden, setIsUiHidden] = useState(false);

  // Memoize filtered lists to prevent unnecessary re-calculations on every render
  const filteredBlackSpots = React.useMemo(() => {
    const withIndices = blackSpots.map((spot, originalIndex) => ({ ...spot, originalIndex }));
    const validSpots = withIndices.filter(spot => spot.latitude != null && !isNaN(spot.latitude) && spot.longitude != null && !isNaN(spot.longitude));
    
    return filterType 
      ? validSpots.filter(spot => 
          spot.riskLevel === filterType || 
          spot.riskFactors.some(f => f.toLowerCase().includes(filterType.toLowerCase())) ||
          (filterType === 'Poor Lighting' && spot.riskFactors.some(f => 
            f.toLowerCase().includes('light') || f.toLowerCase().includes('dark') || f.toLowerCase().includes('visibility') ||
            f.includes('แสงสว่าง') || f.includes('มืด') || f.includes('ทัศนวิสัย')
          )) ||
          (filterType === 'Sharp Curve' && spot.riskFactors.some(f => 
            f.toLowerCase().includes('curve') || f.toLowerCase().includes('winding') || f.toLowerCase().includes('bend') ||
            f.includes('ทางโค้ง') || f.includes('หักศอก') || f.includes('คดเคี้ยว')
          )) ||
          (filterType === 'Construction' && spot.riskFactors.some(f => 
            f.toLowerCase().includes('construction') || f.toLowerCase().includes('work') ||
            f.includes('ก่อสร้าง')
          )) ||
          (filterType === 'Flooding' && spot.riskFactors.some(f => 
            f.toLowerCase().includes('flood') || f.toLowerCase().includes('water') ||
            f.includes('น้ำท่วม') || f.includes('น้ำขัง')
          )) ||
          (filterType === 'Slippery' && spot.riskFactors.some(f => 
            f.toLowerCase().includes('slippery') || f.toLowerCase().includes('oil') || f.toLowerCase().includes('skid') ||
            f.includes('ลื่น')
          )) ||
          (filterType === 'Steep' && spot.riskFactors.some(f => 
            f.toLowerCase().includes('steep') || f.toLowerCase().includes('slope') || f.toLowerCase().includes('hill') ||
            f.includes('ชัน') || f.includes('ลาด')
          ))
        )
      : validSpots;
  }, [blackSpots, filterType]);

  const filteredAccidents = React.useMemo(() => {
    const withIndices = recentAccidents.map((acc, originalIndex) => ({ ...acc, originalIndex }));
    const validAccidents = withIndices.filter(acc => acc.latitude != null && !isNaN(acc.latitude) && acc.longitude != null && !isNaN(acc.longitude));
    
    return filterType === 'Accident' 
      ? validAccidents 
      : (filterType ? [] : validAccidents);
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

  return (
    <div className="h-full w-full relative z-10 bg-[#050505]">

      {/* Floating Action Menu */}
      <div className="absolute min-[500px]:bottom-6 bottom-[100px] right-6 z-[1000] flex flex-col gap-3">
        <AnimatePresence>
          {!isUiHidden && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-3 items-end"
            >
              <button
                onClick={() => setIsSimulateMode(!isSimulateMode)}
                className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl transition-all active:scale-95 border ${
                  isSimulateMode 
                    ? 'bg-blue-600 text-white border-blue-400' 
                    : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-1 rounded-lg ${isSimulateMode ? 'bg-white/20' : 'bg-blue-100'}`}>
                  <Navigation className={`w-6 h-6 ${isSimulateMode ? 'text-white' : 'text-blue-500'}`} />
                </div>
                <span className="text-sm font-extrabold tracking-tight">{t.simulate}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsUiHidden(!isUiHidden)}
          className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10 hover:bg-slate-800 transition-all active:scale-90"
        >
          {isUiHidden ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>
      </div>

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
          onSetUserLocation={setUserLocation}
          isSimulateMode={isSimulateMode}
          onToggleUi={() => setIsUiHidden(prev => !prev)}
          onHideUi={() => setIsUiHidden(true)}
          isUiHidden={isUiHidden}
          setActivePoint={setActivePoint}
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
            activePoint={activePoint}
            setActivePoint={setActivePoint}
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
            activePoint={activePoint}
            setActivePoint={setActivePoint}
            locale={locale}
            t={t}
          />
        ))}

        {/* Journey Hazards */}
        {journeyPlan && journeyPlan.hazardsOnRoute.filter(h => h.lat != null && !isNaN(h.lat) && h.lng != null && !isNaN(h.lng)).map((hazard, idx) => (
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
                    {t.journeyImpact}
                  </div>
                  <p className="text-xs text-purple-600 italic">
                    {t.pathIdentifiedDesc.replace('{origin}', journeyPlan.origin).replace('{destination}', journeyPlan.destination)}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Coaching High Risk Spots */}
        {coachingReport?.highRiskSpots?.map((spot, i) => (
          <CoachingSpotMarker
            key={`coaching-spot-${i}`}
            spot={spot}
            onHideUi={() => setIsUiHidden(true)}
            activePoint={activePoint}
            setActivePoint={setActivePoint}
            t={t}
          />
        ))}

        <MapController 
          selectedPoint={selectedPoint} 
          blackSpots={blackSpots} 
          recentAccidents={recentAccidents || []}
          journeyPlan={journeyPlan}
          coachingReport={coachingReport}
          activePoint={activePoint}
        />
      </MapContainer>

      {/* Mobile Detail Card */}
      <AnimatePresence>
        {activePoint && window.innerWidth < 768 && (
          <motion.div 
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="absolute bottom-6 left-4 right-4 z-[3000] md:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`glass-dark rounded-3xl border-2 p-5 shadow-2xl overflow-hidden relative ${
              'severity' in activePoint ? 'border-red-500/30' : 
              activePoint.riskLevel === 'Critical' ? 'border-red-500/30' :
              activePoint.riskLevel === 'High' ? 'border-orange-500/30' :
              'border-blue-500/30'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {'severity' in activePoint ? (
                    <div className="p-2 bg-red-500/20 rounded-full">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                  ) : (
                    <div className={`p-2 rounded-full ${getRiskColor(activePoint.riskLevel)}`}>
                      <MapPin className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-lg tracking-tight truncate max-w-[200px]">
                      {activePoint.locationName}
                    </h3>
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                         'severity' in activePoint ? 'bg-red-500 text-white' :
                         activePoint.riskLevel === 'Critical' ? 'bg-red-600 text-white' :
                         activePoint.riskLevel === 'High' ? 'bg-orange-500 text-white' :
                         'bg-blue-500 text-white'
                       }`}>
                         {'severity' in activePoint ? activePoint.severity : activePoint.riskLevel}
                       </span>
                       <span className="text-[10px] text-white/50 font-medium">
                         {activePoint.timestamp || (activePoint.latitude != null && !isNaN(activePoint.latitude) && activePoint.longitude != null && !isNaN(activePoint.longitude) ? `${activePoint.latitude.toFixed(3)}, ${activePoint.longitude.toFixed(3)}` : 'Unknown Location')}
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setActivePoint(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* AI Summary / Desc */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {t.aiSummary}
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed italic">
                    "{activePoint.aiSummary || activePoint.description || activePoint.recommendation}"
                  </p>
                </div>

                {/* Recommendation / Avoid */}
                <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20">
                   <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t.howToAvoid}
                  </div>
                  <p className="text-sm text-white font-medium leading-relaxed">
                    {activePoint.avoidanceTip || activePoint.recommendation || (locale === 'en' ? 'Drive with caution.' : 'โปรดขับขี่ด้วยความระมัดระวัง')}
                  </p>
                </div>

                <div className="flex gap-3">
                  {'severity' in activePoint && (
                    <button
                      onClick={() => {
                        onRequestDetailedReport(activePoint);
                        setActivePoint(null);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {t.aiCaseDetail}
                    </button>
                  )}
                  {'riskLevel' in activePoint && (
                    <button
                      onClick={() => {
                        startEditing(activePoint.originalIndex, activePoint);
                        setActivePoint(null);
                        if (window.innerWidth < 768) setIsUiHidden(false);
                      }}
                      className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t.editLocation}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proximity Alert Notification */}
      {activeAlert && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-md animate-bounce transition-all duration-300 ${isUiHidden ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}>
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-2xl flex items-center gap-4 border-2 border-white">
            <div className="bg-white p-2 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg leading-tight">{t.accidentAhead}</h4>
              <p className="text-sm opacity-90">{t.approaching} {activeAlert.locationName}</p>
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
          {t.showControls}
        </button>
      </div>

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
              {filterType === 'Accident' && <span className="text-[9px] text-red-500/70 leading-tight">{t.recentCrashes}</span>}
            </div>
          </button>
          
          <button 
            onClick={() => setFilterType(filterType === 'Critical' ? null : 'Critical')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Critical' ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Critical' ? 'text-red-700' : 'text-slate-700'}`}>{t.critical}</span>
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'High' ? null : 'High')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'High' ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'High' ? 'text-orange-700' : 'text-slate-700'}`}>{t.high}</span>
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Poor Lighting' ? null : 'Poor Lighting')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Poor Lighting' ? 'bg-yellow-50 ring-1 ring-yellow-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border border-dashed border-yellow-600 bg-yellow-100 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Poor Lighting' ? 'text-yellow-700' : 'text-slate-700'}`}>{t.poorLighting}</span>
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Sharp Curve' ? null : 'Sharp Curve')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Sharp Curve' ? 'bg-slate-100 ring-1 ring-slate-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-0.5 bg-slate-400"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Sharp Curve' ? 'text-slate-700' : 'text-slate-700'}`}>{t.sharpCurve}</span>
              {filterType === 'Sharp Curve' && <span className="text-[9px] text-slate-500 leading-tight">{t.dangerousBends}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Construction' ? null : 'Construction')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Construction' ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border-2 border-orange-500 bg-orange-100 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Construction' ? 'text-orange-700' : 'text-slate-700'}`}>{t.construction}</span>
              {filterType === 'Construction' && <span className="text-[9px] text-orange-500 leading-tight">{t.activeRoadwork}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Slippery' ? null : 'Slippery')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Slippery' ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border border-dashed border-indigo-500 bg-indigo-50 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Slippery' ? 'text-indigo-700' : 'text-slate-700'}`}>{t.slipperyRoad}</span>
              {filterType === 'Slippery' && <span className="text-[9px] text-indigo-500 leading-tight">{t.skidHazards}</span>}
            </div>
          </button>

          <button 
            onClick={() => setFilterType(filterType === 'Steep' ? null : 'Steep')}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg transition-all text-left group ${filterType === 'Steep' ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-slate-50'}`}
          >
            <div className="w-4 h-4 border border-dashed border-purple-500 bg-purple-50 rounded-full"></div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${filterType === 'Steep' ? 'text-purple-700' : 'text-slate-700'}`}>{t.steepSlope}</span>
              {filterType === 'Steep' && <span className="text-[9px] text-purple-500 leading-tight">{t.dangerInclines}</span>}
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
              <h3 className="font-bold text-slate-900">{t.removeRecord}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              {t.removeConfirm}
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
