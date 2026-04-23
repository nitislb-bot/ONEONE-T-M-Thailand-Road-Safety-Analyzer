import React, { useState, useEffect } from 'react';
import { analyzeArea, SafetyAnalysis, getDetailedAccidentReport, Accident } from '../services/geminiService';
import { User } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { MapPin, Navigation, AlertTriangle, ShieldCheck, Loader2, Database, Printer, Download, FileText, X, History, ChevronRight, CheckSquare, Square, Plus, Search, AlertCircle, LogOut, Trash2, User as UserIcon, ThumbsUp, RefreshCw, Info, ExternalLink, Languages } from 'lucide-react';

import { Locale, translations } from '../i18n';

interface SidebarProps {
  analysis: SafetyAnalysis | null;
  onAnalysisComplete: (analysis: SafetyAnalysis) => void;
  history: SafetyAnalysis[];
  onLoadHistory: (analysis: SafetyAnalysis) => void;
  onPointClick: (lat: number, lng: number) => void;
  onDeleteAnalysis: (id: string) => void;
  user: User;
  onSignOut: () => void;
  onShowAbout: () => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const PREDEFINED_RISK_FACTORS = [
  "Heavy Truck Traffic",
  "Poor Lighting",
  "Sharp Curves",
  "Frequent Flooding",
  "Construction Zones",
  "High Speed Zones",
  "Animal Crossings",
  "Fog/Poor Visibility",
  "Slippery Road",
  "Steep Slope",
  "Pedestrian Crossing",
  "School Zone"
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  analysis, 
  onAnalysisComplete, 
  history, 
  onLoadHistory,
  onPointClick,
  onDeleteAnalysis,
  user,
  onSignOut,
  onShowAbout,
  locale,
  setLocale
}) => {
  const t = translations[locale];
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [workOrderName, setWorkOrderName] = useState('');
  const [historicalData, setHistoricalData] = useState('');
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([]);
  const [customRiskInput, setCustomRiskInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [detailedReport, setDetailedReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Accident | Accident[] | null>(null);

  // Update local form state when analysis changes from history
  useEffect(() => {
    if (analysis && analysis.province) {
      setProvince(analysis.province || '');
      setDistrict(analysis.district || '');
      setWorkOrderName(analysis.workOrderName || '');
      setSelectedRiskFactors(analysis.customRiskFactors || []);
    }
  }, [analysis]);

  const toggleRiskFactor = (factor: string) => {
    setSelectedRiskFactors(prev => 
      prev.includes(factor) 
        ? prev.filter(f => f !== factor) 
        : [...prev, factor]
    );
  };

  const addCustomRiskFactor = () => {
    if (customRiskInput.trim() && !selectedRiskFactors.includes(customRiskInput.trim())) {
      setSelectedRiskFactors(prev => [...prev, customRiskInput.trim()]);
      setCustomRiskInput('');
    }
  };

  const handleReset = () => {
    setProvince('');
    setDistrict('');
    setWorkOrderName('');
    setHistoricalData('');
    setSelectedRiskFactors([]);
    setCustomRiskInput('');
    setError(null);
    setDetailedReport(null);
    setDeleteConfirmId(null);
  };

  const handleGenerateDetailedReport = async (specificAccident?: Accident, langOverride?: 'English' | 'Thai') => {
    if (!analysis || !province || !district) return;
    
    const target = specificAccident || analysis.recentAccidents;
    setReportTarget(target);
    setIsGeneratingReport(true);
    try {
      const reportLang = langOverride || (locale === 'th' ? 'Thai' : 'English');
      const report = await getDetailedAccidentReport(
        province, 
        district, 
        target,
        reportLang
      );
      setDetailedReport(report);
      setIsReportModalOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate detailed report.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!province || !district) {
      setError('Please fill in both Province and District.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeArea(province, district, historicalData, selectedRiskFactors);
      result.province = province;
      result.district = district;
      result.workOrderName = workOrderName;
      result.customRiskFactors = selectedRiskFactors;
      onAnalysisComplete(result);
      setShowHistory(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const exportToJSON = () => {
    if (!analysis) return;
    const dataStr = JSON.stringify(analysis, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `area-safety-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!analysis) return;
    const headers = ['Location Name', 'Latitude', 'Longitude', 'Risk Level', 'Accidents', 'Injuries', 'Fatalities', 'Risk Factors', 'Recommendation'];
    const rows = analysis.blackSpots.map(spot => [
      `"${spot.locationName.replace(/"/g, '""')}"`,
      spot.latitude,
      spot.longitude,
      spot.riskLevel,
      spot.accidentCount,
      spot.injuryCount,
      spot.fatalityCount,
      `"${spot.riskFactors.join('; ').replace(/"/g, '""')}"`,
      `"${spot.recommendation.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `area-safety-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full md:w-96 flex-1 md:flex-none md:h-full bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-white/10 flex flex-col shadow-lg z-10 overflow-hidden text-white print:w-full print:h-auto print:shadow-none print:border-none print:overflow-visible">
      <div className="p-4 md:p-6 border-b border-white/10 bg-white/5 print:bg-white print:border-b-2 print:border-gray-800 print:p-0 print:pb-4 print:mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{user.displayName || 'User'}</span>
              <span className="text-[10px] text-white/50 truncate max-w-[120px]">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setLocale(locale === 'en' ? 'th' : 'en')}
              className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-full text-white/50 hover:text-blue-400 hover:bg-blue-900/20 transition-all text-[10px] font-bold mr-1"
            >
              <Languages className="w-3 h-3" />
              {locale === 'en' ? 'ไทย' : 'EN'}
            </button>
            <button 
              onClick={onShowAbout}
              className="p-2 text-white/40 hover:text-blue-400 hover:bg-blue-900/20 rounded-full transition-colors"
              title={t.aboutTitle}
            >
              <Info className="w-4 h-4" />
            </button>
            <button 
              onClick={onSignOut}
              className="p-2 text-white/40 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
              title={t.signOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-1 md:mb-2">
          <div className="flex items-center gap-2 md:gap-3">
            <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-blue-500 print:text-gray-900" />
            <h1 className="text-lg md:text-xl font-bold text-white leading-tight">Road Safety Analyzer</h1>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-full transition-colors print:hidden ${
              showHistory ? 'text-blue-400 bg-blue-900/30' : 'text-white/50 hover:text-blue-400 hover:bg-blue-900/30'
            }`}
            title={t.historyTitle}
          >
            <History className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs md:text-sm text-white/50 mt-1 md:mt-2 print:text-gray-800">Evaluate and alert company drivers about travel risks.</p>
      </div>

      <div className="flex-1 overflow-y-auto print:overflow-visible">
        {showHistory ? (
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Analysis History</h2>
              <button 
                onClick={() => {
                  setShowHistory(false);
                  setHistorySearchTerm('');
                }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Back to Form
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search history (Name, Province, District...)"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs text-white placeholder:text-white/30"
              />
              {historySearchTerm && (
                <button 
                  onClick={() => setHistorySearchTerm('')}
                  className="absolute right-3 top-2.5 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-xl">
                  <History className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">{t.noHistory}</p>
                  <p className="text-[10px] text-white/20 mt-1">{t.startNewAnalysis}</p>
                </div>
              ) : history.filter(item => {
                const searchLower = historySearchTerm.toLowerCase();
                return (
                  item.workOrderName?.toLowerCase().includes(searchLower) ||
                  item.province?.toLowerCase().includes(searchLower) ||
                  item.district?.toLowerCase().includes(searchLower) ||
                  item.createdBy?.toLowerCase().includes(searchLower)
                );
              }).length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Search className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/40">{t.noMatches} "{historySearchTerm}"</p>
                </div>
              ) : (
                history
                  .filter(item => {
                    const searchLower = historySearchTerm.toLowerCase();
                    return (
                      item.workOrderName?.toLowerCase().includes(searchLower) ||
                      item.province?.toLowerCase().includes(searchLower) ||
                      item.district?.toLowerCase().includes(searchLower) ||
                      item.createdBy?.toLowerCase().includes(searchLower)
                    );
                  })
                  .map((item) => (
                  <div className="relative group/item" key={item.id}>
                    <button
                      onClick={() => {
                        onLoadHistory(item);
                        setShowHistory(false);
                        setHistorySearchTerm('');
                      }}
                      className="w-full text-left p-3 border border-white/10 rounded-lg hover:border-blue-500/50 hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-white text-sm truncate pr-16">
                          {item.workOrderName || `${item.district}, ${item.province}`}
                        </span>
                        <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-blue-400 shrink-0 mt-0.5" />
                      </div>
                      {item.workOrderName && (
                        <div className="text-[10px] text-white/60 mb-1 truncate">
                          {item.district}, {item.province}
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 text-[10px] text-white/40">
                        <div className="flex justify-between items-center">
                          <span>{new Date(item.timestamp || 0).toLocaleDateString()}</span>
                          {item.createdBy && <span className="text-blue-400/60">{t.by}: {item.createdBy}</span>}
                        </div>
                        {item.lastUpdatedBy && item.lastUpdatedBy !== item.createdBy && (
                          <div className="text-right">{t.updatedBy}: {item.lastUpdatedBy}</div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getRiskColor(item.overallRisk)}`}>
                          {item.overallRisk} {locale === 'en' ? 'Risk' : 'ความเสี่ยง'}
                        </span>
                        <span className="text-xs text-white/40">{item.blackSpots.length} {t.spots}</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(item.id!);
                      }}
                      className="absolute top-3 right-8 p-1.5 text-white/30 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-all z-10"
                      title="Delete Analysis"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6 print:p-0">
            <form onSubmit={handleSubmit} className="space-y-4 print:hidden">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">{t.workOrderName}</label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={workOrderName}
                  onChange={(e) => setWorkOrderName(e.target.value)}
                  placeholder="e.g., Q1 Safety Audit - North Road"
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">{t.province}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="e.g., Bangkok, Chiang Mai"
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">{t.district}</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g., Pathum Wan, Mueang"
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-white/40" />
                  Risk Factors to Prioritize (Optional)
                </div>
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {PREDEFINED_RISK_FACTORS.map(factor => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => toggleRiskFactor(factor)}
                    className={`flex items-center gap-2 p-2 text-left text-xs rounded-md border transition-colors ${
                      selectedRiskFactors.includes(factor)
                        ? 'bg-blue-900/30 border-blue-500/50 text-blue-300'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {selectedRiskFactors.includes(factor) ? (
                      <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{factor}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRiskInput}
                  onChange={(e) => setCustomRiskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomRiskFactor();
                    }
                  }}
                  placeholder="Add custom risk factor..."
                  className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs text-white placeholder:text-white/30"
                />
                <button
                  type="button"
                  onClick={addCustomRiskFactor}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white/60 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {selectedRiskFactors.filter(f => !PREDEFINED_RISK_FACTORS.includes(f)).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedRiskFactors.filter(f => !PREDEFINED_RISK_FACTORS.includes(f)).map(factor => (
                    <span 
                      key={factor}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 text-blue-300 border border-blue-500/30 rounded-full text-[10px] font-medium"
                    >
                      {factor}
                      <button 
                        type="button"
                        onClick={() => toggleRiskFactor(factor)}
                        className="hover:text-white"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                <div className="flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-white/40" />
                  Local Observations / Physical Details
                </div>
              </label>
              <textarea
                value={historicalData}
                onChange={(e) => setHistoricalData(e.target.value)}
                placeholder="Describe physical city details, road conditions, or specific local hazards you've observed..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-y text-sm text-white placeholder:text-white/30"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Area...
                  </>
                ) : (
                  'Analyze Area Risks'
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="px-3 py-2.5 border border-white/10 text-white/60 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Reset Form"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            {isLoading && (
              <p className="text-[10px] text-center text-white/40 mt-2 animate-pulse flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3" />
                Pulling real-world map & safety data...
              </p>
            )}
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-800/30 rounded-md">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-200">Analysis Failed</h3>
                  <p className="text-sm text-red-300 mt-1">{error}</p>
                  
                  <div className="mt-3 pt-3 border-t border-red-800/30">
                    <p className="text-xs font-semibold text-red-200 mb-1">Common causes & solutions:</p>
                    <ul className="text-xs text-red-300 list-disc list-inside space-y-1">
                      <li>Check for typos in your location or province names.</li>
                      <li>Ensure the start and end locations are actually within or connected to the specified province.</li>
                      <li>Try using broader or more well-known road names.</li>
                      <li>If pasting historical data, ensure it is readable text, CSV, or JSON.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {analysis && !isLoading && (
            <div className="mt-8 space-y-6 print:mt-0">
              <div className="border-t border-white/10 pt-6 print:border-none print:pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex flex-col">
                    <h2 className="text-lg font-semibold text-white">
                      {analysis.workOrderName || 'Analysis Summary'}
                    </h2>
                    {analysis.workOrderName && (
                      <span className="text-xs text-white/40">
                        {analysis.district}, {analysis.province}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 print:hidden flex-wrap">
                    <button
                      onClick={exportToJSON}
                      title="Export JSON"
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 rounded-md transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> JSON
                    </button>
                    <button
                      onClick={exportToCSV}
                      title="Export CSV"
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 rounded-md transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={() => window.print()}
                      title="Print / Save PDF"
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-300 bg-blue-900/30 hover:bg-blue-900/50 rounded-md transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
                <div className={`p-4 rounded-lg border ${getRiskColor(analysis.overallRisk)} mb-4 print:border-gray-300 print:bg-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Overall Area Risk</span>
                    <span className="font-bold uppercase tracking-wider text-sm px-2 py-1 bg-black/20 rounded">{analysis.overallRisk}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{analysis.summary}</p>
                  
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-white/40">
                      <span>Created by: <span className="text-white/60">{analysis.createdBy || 'System'}</span></span>
                      <span>{new Date(analysis.timestamp || 0).toLocaleString()}</span>
                    </div>
                    {analysis.lastUpdatedBy && analysis.lastUpdatedBy !== analysis.createdBy && (
                      <div className="text-[10px] text-white/40">
                        Last updated by: <span className="text-white/60">{analysis.lastUpdatedBy}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {analysis.historicalDataSummary && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors print:hidden"
                      >
                        <FileText className="w-4 h-4" />
                        Local Observations
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerateDetailedReport()}
                      disabled={isGeneratingReport}
                      className="flex items-center gap-1.5 text-sm font-bold text-blue-400 hover:text-blue-300 bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-800/30 transition-all print:hidden disabled:opacity-50 shadow-sm"
                    >
                      {isGeneratingReport ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4" />
                      )}
                      AI More Detail Analysis
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white mb-3">Area Safety Points ({analysis.blackSpots.length})</h2>
                <div className="space-y-4">
                  {analysis.blackSpots.map((spot, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white/5 border border-white/10 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-500/50 group"
                      onClick={() => onPointClick(spot.latitude, spot.longitude)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">{spot.locationName}</h3>
                          {spot.confirmations ? (
                            <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold mt-0.5">
                              <ThumbsUp className="w-2.5 h-2.5" />
                              {spot.confirmations} Verified
                            </div>
                          ) : null}
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getRiskColor(spot.riskLevel)}`}>
                          {spot.riskLevel}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-3 mb-2 text-center">
                        <div className="bg-white/5 border border-white/10 p-1.5 rounded-md">
                          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Accidents</div>
                          <div className="font-bold text-white">{spot.accidentCount}</div>
                        </div>
                        <div className="bg-orange-900/20 border border-orange-800/30 p-1.5 rounded-md">
                          <div className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">Injuries</div>
                          <div className="font-bold text-orange-300">{spot.injuryCount}</div>
                        </div>
                        <div className="bg-red-900/20 border border-red-800/30 p-1.5 rounded-md">
                          <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold">Fatalities</div>
                          <div className="font-bold text-red-300">{spot.fatalityCount}</div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Risk Factors</h4>
                        <ul className="list-disc list-inside text-sm text-white/80 space-y-0.5">
                          {spot.riskFactors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="mt-3 bg-blue-900/20 p-3 rounded-md border border-blue-800/30">
                        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Actionable Advice</h4>
                        <p className="text-sm text-blue-200">{spot.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {analysis.recentAccidents && analysis.recentAccidents.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      Recent Accidents ({analysis.recentAccidents.length})
                    </h2>
                    <button
                      onClick={() => handleGenerateDetailedReport()}
                      disabled={isGeneratingReport}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-blue-400 hover:bg-blue-900/30 border border-blue-800/30 rounded-md transition-all disabled:opacity-50"
                    >
                      {isGeneratingReport ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3 h-3" />
                      )}
                      AI More Detail
                    </button>
                  </div>
                  <div className="space-y-4">
                    {analysis.recentAccidents.map((acc, idx) => (
                      <div 
                        key={idx} 
                        className="bg-red-900/10 border border-red-800/20 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-red-500/50 group"
                        onClick={() => onPointClick(acc.latitude, acc.longitude)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <h3 className="font-medium text-white group-hover:text-red-400 transition-colors">{acc.locationName}</h3>
                            {acc.confirmations ? (
                              <div className="flex items-center gap-1 text-[10px] text-red-400 font-bold mt-0.5">
                                <ThumbsUp className="w-2.5 h-2.5" />
                                {acc.confirmations} Verified
                              </div>
                            ) : null}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-900/40 text-red-200 rounded uppercase border border-red-800/30">
                            {acc.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
                          <History className="w-3 h-3" />
                          {acc.timestamp}
                        </div>
                        <p className="text-sm text-white/70 italic mb-3">"{acc.description}"</p>
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Type: {acc.type}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateDetailedReport(acc);
                            }}
                            disabled={isGeneratingReport}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-900/30 border border-red-800/30 rounded transition-all disabled:opacity-50"
                          >
                            <Info className="w-3 h-3" />
                            Case Detail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] w-full max-w-sm rounded-xl shadow-2xl p-6 border border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Delete Analysis?</h3>
            </div>
            <p className="text-white/60 mb-6 leading-relaxed">
              Are you sure you want to delete this analysis from the shared history? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteAnalysis(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report Modal */}
      {isReportModalOpen && detailedReport && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-blue-900/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">{t.detailedReportTitle}</h2>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-white/60">
                   <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                   <p className="font-medium animate-pulse">{t.generatingReport}</p>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm prose-blue max-w-none text-white/90">
                  <div className="markdown-body">
                    <ReactMarkdown>{detailedReport}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5 flex flex-wrap justify-between items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerateDetailedReport(Array.isArray(reportTarget) ? undefined : (reportTarget as Accident), 'Thai')}
                  disabled={isGeneratingReport}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600/20 border border-blue-500/30 rounded-lg hover:bg-blue-600/40 transition-colors disabled:opacity-50"
                >
                  <Languages className="w-3.5 h-3.5" />
                  {t.translateToThai}
                </button>
                <button
                  onClick={() => handleGenerateDetailedReport(Array.isArray(reportTarget) ? undefined : (reportTarget as Accident), 'English')}
                  disabled={isGeneratingReport}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  <Languages className="w-3.5 h-3.5" />
                  {t.translateToEnglish}
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  {t.printReport}
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Data Modal */}
      {isModalOpen && analysis?.historicalDataSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-blue-900/20">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Local Observations Impact</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="prose prose-invert prose-sm max-w-none text-white/80 whitespace-pre-wrap">
                {analysis.historicalDataSummary}
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
