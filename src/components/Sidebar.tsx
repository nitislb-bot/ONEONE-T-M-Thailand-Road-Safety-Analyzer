import React, { useState, useEffect, useMemo } from 'react';
import { analyzeArea, SafetyAnalysis, getDetailedAccidentReport, Accident, analyzeAccidentTrends, getJourneySafetyPlan, JourneySafetyReport, getDriverCoaching, DriverCoachingReport } from '../services/geminiService';
import { User } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { MapPin, Navigation, AlertTriangle, ShieldCheck, Loader2, Database, Printer, Download, FileText, X, History, ChevronRight, CheckSquare, Square, Plus, Search, AlertCircle, LogOut, Trash2, User as UserIcon, ThumbsUp, RefreshCw, Info, ExternalLink, Languages, BarChart3, Route, Wind, Car, GraduationCap, CheckCircle2, Lightbulb, ClipboardCheck, Maximize2, Minimize2, Skull } from 'lucide-react';

import { Locale, translations } from '../i18n';

interface SidebarProps {
  analysis: SafetyAnalysis | null;
  onAnalysisComplete: (analysis: SafetyAnalysis) => void;
  history: SafetyAnalysis[];
  journeyHistory: JourneySafetyReport[];
  coachingHistory: DriverCoachingReport[];
  onLoadHistory: (analysis: SafetyAnalysis) => void;
  onLoadJourneyHistory: (plan: JourneySafetyReport) => void;
  onLoadCoachingHistory: (coaching: DriverCoachingReport) => void;
  onPointClick: (lat: number, lng: number) => void;
  onDeleteAnalysis: (id: string) => void;
  user: User;
  onSignOut: () => void;
  onShowAbout: () => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  requestedAccident: Accident | null;
  clearRequestedAccident: () => void;
  onJourneyPlanComplete: (plan: JourneySafetyReport) => void;
  onCoachingReportComplete: (report: DriverCoachingReport) => void;
  coachingReport: DriverCoachingReport | null;
  isFullScreen?: boolean;
  toggleFullScreen?: () => void;
}

const PREDEFINED_RISK_FACTORS = [
  "การจราจรของรถบรรทุกหนัก",
  "แสงสว่างไม่เพียงพอ",
  "ทางโค้งหักศอก",
  "น้ำท่วมขังบ่อยครั้ง",
  "พื้นที่ก่อสร้าง",
  "เขตใช้ความเร็วสูง",
  "จุดระวังช้างหรือสัตว์ข้ามทาง",
  "หมอกหนา/ทัศนวิสัยต่ำ",
  "ถนนลื่น",
  "ทางลาดชัน",
  "ทางม้าลาย/คนข้ามถนน",
  "เขตโรงเรียน"
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  analysis, 
  onAnalysisComplete, 
  history, 
  journeyHistory,
  coachingHistory,
  onLoadHistory,
  onLoadJourneyHistory,
  onLoadCoachingHistory,
  onPointClick,
  onDeleteAnalysis,
  user,
  onSignOut,
  onShowAbout,
  locale,
  setLocale,
  requestedAccident,
  clearRequestedAccident,
  onJourneyPlanComplete,
  onCoachingReportComplete,
  coachingReport,
  isFullScreen,
  toggleFullScreen
}) => {
  const [sidebarMode, setSidebarMode] = useState<'area' | 'journey' | 'coaching' | 'info'>('area');
  const [historyTab, setHistoryTab] = useState<'area' | 'journey' | 'coaching'>('area');
  const [journeyOrigin, setJourneyOrigin] = useState('');
  const [journeyDest, setJourneyDest] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [journeyReport, setJourneyReport] = useState<JourneySafetyReport | null>(null);
  const [isGeneratingJourney, setIsGeneratingJourney] = useState(false);
  const [isGeneratingCoaching, setIsGeneratingCoaching] = useState(false);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [workOrderName, setWorkOrderName] = useState('');
  const [historicalData, setHistoricalData] = useState('');
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([]);
  const [customRiskInput, setCustomRiskInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingTrends, setIsGeneratingTrends] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [detailedReport, setDetailedReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<Accident | Accident[] | null>(null);
  const t = translations[locale];

  // Update local form state when analysis changes from history
  useEffect(() => {
    if (analysis && analysis.province) {
      setProvince(analysis.province || '');
      setDistrict(analysis.district || '');
      setWorkOrderName(analysis.workOrderName || '');
      setSelectedRiskFactors(analysis.customRiskFactors || []);
    }
  }, [analysis]);

  // Handle detailed report requests from components outside sidebar (e.g. Map)
  useEffect(() => {
    if (requestedAccident) {
      handleGenerateDetailedReport(requestedAccident);
      clearRequestedAccident();
    }
  }, [requestedAccident]);

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

  const handleGenerateTrendAnalysis = async () => {
    if (!analysis || !province || !district) return;
    
    setIsGeneratingTrends(true);
    setReportTarget(analysis.recentAccidents);
    try {
      const trends = await analyzeAccidentTrends(province, district, analysis.recentAccidents);
      setDetailedReport(trends);
      setIsReportModalOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate trend analysis.');
    } finally {
      setIsGeneratingTrends(false);
    }
  };

  const handleGenerateJourneyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleMapsLink && (!journeyOrigin || !journeyDest)) {
      setError(t.fillOriginDest);
      return;
    }
    
    setIsGeneratingJourney(true);
    setError(null);
    try {
      const plan = await getJourneySafetyPlan(
        googleMapsLink ? '' : journeyOrigin, 
        googleMapsLink ? '' : journeyDest, 
        googleMapsLink ? [] : waypoints, 
        undefined, 
        analysis || undefined,
        googleMapsLink || undefined
      );
      setJourneyReport(plan);
      onJourneyPlanComplete(plan);
    } catch (err: any) {
      setError(err.message || 'Failed to generate journey safety plan.');
    } finally {
      setIsGeneratingJourney(false);
    }
  };

  const handleGenerateCoaching = async () => {
    if (!analysis) {
      setError(t.performAnalysisFirst);
      return;
    }
    
    setIsGeneratingCoaching(true);
    setError(null);
    try {
      const report = await getDriverCoaching(analysis, journeyReport || undefined);
      setSidebarMode('coaching');
      onCoachingReportComplete(report);
    } catch (err: any) {
      setError(err.message || 'Failed to generate coaching program.');
    } finally {
      setIsGeneratingCoaching(false);
    }
  };

  const severityStats = useMemo(() => {
    if (!analysis || !analysis.recentAccidents) return null;
    const stats = { Fatal: 0, Major: 0, Minor: 0 };
    analysis.recentAccidents.forEach(acc => {
      if (acc.severity in stats) stats[acc.severity as keyof typeof stats]++;
    });
    return stats;
  }, [analysis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!province || !district) {
      setError(t.fillProvinceDistrict);
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

  const translateRisk = (risk: string) => {
    switch (risk) {
      case 'Critical': return t.criticalRisk || 'Critical Risk';
      case 'High': return t.highRisk || 'High Risk';
      case 'Medium': return t.mediumRisk || 'Medium Risk';
      case 'Low': return t.lowRisk || 'Low Risk';
      case 'Safe': return t.safe || 'Safe';
      case 'Caution': return t.caution || 'Caution';
      case 'High Risk': return t.highRisk || 'High Risk';
      default: return risk;
    }
  };

  const translateSeverity = (severity: string) => {
    switch (severity) {
      case 'Fatal': return t.fatal || 'Fatal';
      case 'Major': return t.major || 'Major';
      case 'Minor': return t.minor || 'Minor';
      default: return severity;
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
    <div className={`w-full ${isFullScreen ? '' : 'md:w-96 md:flex-none'} flex-1 md:h-full bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-white/10 flex flex-col shadow-lg z-10 overflow-hidden text-white print:w-full print:h-auto print:shadow-none print:border-none print:overflow-visible`}>
      {/* Mode Toggle */}
      <div className="flex p-2 bg-white/5 border-b border-white/10 print-hide">
        <button
          onClick={() => setSidebarMode('area')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sidebarMode === 'area' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
        >
          <MapPin className="w-4 h-4" />
          {t.areaAnalysis}
        </button>
        <button
          onClick={() => setSidebarMode('journey')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sidebarMode === 'journey' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
        >
          <Route className="w-4 h-4" />
          {t.journeyPlan}
        </button>
        <button
          onClick={() => setSidebarMode('coaching')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sidebarMode === 'coaching' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
        >
          <GraduationCap className="w-4 h-4" />
          {t.driverCoaching || 'Coaching'}
        </button>
      </div>

      <div className="p-4 md:p-6 border-b border-white/10 bg-white/5 print:bg-white print:border-b-2 print:border-gray-800 print:p-0 print:pb-4 print:mb-4">
        <div className="flex items-center justify-between mb-3 print-hide">
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
            {toggleFullScreen && (
              <button 
                onClick={toggleFullScreen}
                className="hidden md:flex p-2 text-white/40 hover:text-blue-400 hover:bg-blue-900/20 rounded-full transition-colors"
                title={isFullScreen ? t.exitFullScreen : t.fullScreen}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
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
            <h1 className="text-lg md:text-xl font-bold text-white leading-tight">{t.roadSafetyAnalyzer}</h1>
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
        <p className="text-xs md:text-sm text-white/50 mt-1 md:mt-2 print:text-gray-800">{t.evaluateIntro}</p>
      </div>

      <div className="px-4 md:px-6 py-2 border-b border-white/5 bg-black/20 print-hide">
        <div className="flex bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => { setSidebarMode('area'); setShowHistory(false); }}
            className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${sidebarMode === 'area' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
          >
            {t.areaAnalysis || 'Area'}
          </button>
          <button
            onClick={() => { setSidebarMode('journey'); setShowHistory(false); }}
            className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${sidebarMode === 'journey' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
          >
            {t.journeyPlan || 'Journey'}
          </button>
          <button
            onClick={() => { setSidebarMode('coaching'); setShowHistory(false); }}
            className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${sidebarMode === 'coaching' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
          >
            {t.driverCoaching || 'Coaching'}
          </button>
          <button
            onClick={() => { setSidebarMode('info'); setShowHistory(false); }}
            className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${sidebarMode === 'info' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
          >
            {t.aboutTitle || 'Info'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto print:overflow-visible">
        {showHistory ? (
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{t.historyTitle}</h2>
              <button 
                onClick={() => {
                  setShowHistory(false);
                  setHistorySearchTerm('');
                }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {t.backToForm}
              </button>
            </div>

            <div className="flex bg-white/5 p-1 rounded-lg mb-4">
              <button
                onClick={() => setHistoryTab('area')}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${historyTab === 'area' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
              >
                {t.areaAnalysis || 'Area'}
              </button>
              <button
                onClick={() => setHistoryTab('journey')}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${historyTab === 'journey' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
              >
                {t.journeyPlan || 'Journey'}
              </button>
              <button
                onClick={() => setHistoryTab('coaching')}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition-all ${historyTab === 'coaching' ? 'bg-blue-600 text-white shadow-sm' : 'text-white/50 hover:text-white/80'}`}
              >
                {t.driverCoaching || 'Coaching'}
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder={t.searchHistoryPlaceholder}
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
              {historyTab === 'area' && (
                history.length === 0 ? (
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
                            {translateRisk(item.overallRisk)}
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
                )
              )}

              {historyTab === 'journey' && (
                journeyHistory.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-xl">
                    <Route className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/40">{t.noHistory}</p>
                  </div>
                ) : journeyHistory.filter(item => {
                  const searchLower = historySearchTerm.toLowerCase();
                  return (
                    item.origin?.toLowerCase().includes(searchLower) ||
                    item.destination?.toLowerCase().includes(searchLower) ||
                    item.createdBy?.toLowerCase().includes(searchLower)
                  );
                }).length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <Search className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/40">{t.noMatches} "{historySearchTerm}"</p>
                  </div>
                ) : (
                  journeyHistory
                    .filter(item => {
                      const searchLower = historySearchTerm.toLowerCase();
                      return (
                        item.origin?.toLowerCase().includes(searchLower) ||
                        item.destination?.toLowerCase().includes(searchLower) ||
                        item.createdBy?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((item) => (
                    <div className="relative group/item" key={item.id}>
                      <button
                        onClick={() => {
                          onLoadJourneyHistory(item);
                          setJourneyReport(item);
                          setSidebarMode('journey');
                          setShowHistory(false);
                          setHistorySearchTerm('');
                        }}
                        className="w-full text-left p-3 border border-white/10 rounded-lg hover:border-blue-500/50 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-white text-sm truncate pr-6">
                            {item.origin} → {item.destination}
                          </span>
                          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-blue-400 shrink-0 mt-0.5" />
                        </div>
                        <div className="flex flex-col gap-0.5 text-[10px] text-white/40">
                          <div className="flex justify-between items-center">
                            <span>{new Date(item.timestamp || 0).toLocaleDateString()}</span>
                            {item.createdBy && <span className="text-blue-400/60">{t.by}: {item.createdBy}</span>}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.overallSafetyRating === 'High Risk' ? 'bg-red-500 text-white' : item.overallSafetyRating === 'Caution' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'}`}>
                            {translateRisk(item.overallSafetyRating)}
                          </span>
                        </div>
                      </button>
                    </div>
                  ))
                )
              )}

              {historyTab === 'coaching' && (
                coachingHistory.length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-xl">
                    <GraduationCap className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/40">{t.noHistory}</p>
                  </div>
                ) : coachingHistory.filter(item => {
                  const searchLower = historySearchTerm.toLowerCase();
                  return (
                    item.locationContext?.toLowerCase().includes(searchLower) ||
                    item.createdBy?.toLowerCase().includes(searchLower)
                  );
                }).length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <Search className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/40">{t.noMatches} "{historySearchTerm}"</p>
                  </div>
                ) : (
                  coachingHistory
                    .filter(item => {
                      const searchLower = historySearchTerm.toLowerCase();
                      return (
                        item.locationContext?.toLowerCase().includes(searchLower) ||
                        item.createdBy?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((item) => (
                    <div className="relative group/item" key={item.id}>
                      <button
                        onClick={() => {
                          onLoadCoachingHistory(item);
                          setSidebarMode('coaching');
                          setShowHistory(false);
                          setHistorySearchTerm('');
                        }}
                        className="w-full text-left p-3 border border-white/10 rounded-lg hover:border-blue-500/50 hover:bg-white/5 transition-colors group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-white text-sm truncate pr-6">
                            {t.driverCoaching} {item.locationContext ? `- ${item.locationContext}` : ''}
                          </span>
                          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-blue-400 shrink-0 mt-0.5" />
                        </div>
                        <div className="flex flex-col gap-0.5 text-[10px] text-white/40">
                          <div className="flex justify-between items-center">
                            <span>{new Date(item.timestamp || 0).toLocaleDateString()}</span>
                            {item.createdBy && <span className="text-blue-400/60">{t.by}: {item.createdBy}</span>}
                          </div>
                        </div>
                      </button>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6 print:p-0">
            <div className="space-y-6">
              {sidebarMode === 'info' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                  <div className="bg-blue-900/10 border border-blue-500/30 p-6 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Info className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">{t.aboutTitle || 'Road Safety Information'}</h3>
                    </div>
                    
                    <p className="text-sm text-white/70 leading-relaxed mb-6 font-medium">
                      {t.thailandSafetyContext}
                    </p>

                    <a 
                      href="https://extranet.who.int/roadsafety/death-on-the-roads/#country_or_area/THA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group active:scale-95"
                    >
                      <div className="flex items-center gap-3">
                        <ExternalLink className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                          {t.whoRoadSafetyLink}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    </a>
                  </div>

                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <ThumbsUp className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Credits & Values</h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed italic mb-6">
                      {t.credits}
                    </p>
                    <div className="pt-4 border-t border-white/5">
                      <div className="flex items-center justify-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest">
                        <ShieldCheck className="w-4 h-4" />
                        <span>{t.staySafe}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : sidebarMode === 'journey' ? (
                <>
                  <form onSubmit={handleGenerateJourneyPlan} className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Route className="w-4 h-4 text-blue-400" />
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t.googleMapsLink}</h4>
                      </div>
                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-2.5 h-4 w-4 text-white/30" />
                        <input
                          type="text"
                          value={googleMapsLink}
                          onChange={(e) => setGoogleMapsLink(e.target.value)}
                          placeholder={t.pasteGoogleMapsLink}
                          className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs text-white placeholder:text-white/20"
                        />
                      </div>
                    </div>

                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">OR</span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">{t.origin}</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                        <input
                          type="text"
                          value={journeyOrigin}
                          onChange={(e) => setJourneyOrigin(e.target.value)}
                          placeholder={t.provincePlaceholder}
                          disabled={!!googleMapsLink}
                          className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/30 disabled:opacity-50"
                        />
                      </div>
                      {analysis && analysis.province && (
                        <div className="mt-1 flex flex-col gap-1">
                          <button 
                            type="button"
                            onClick={() => setJourneyOrigin(`${analysis.district}, ${analysis.province}`)}
                            disabled={!!googleMapsLink}
                            className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {t.selectFromAnalysis}: {analysis.district}, {analysis.province}
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">{t.destination}</label>
                      <div className="relative">
                        <Navigation className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                        <input
                          type="text"
                          value={journeyDest}
                          onChange={(e) => setJourneyDest(e.target.value)}
                          placeholder={t.provincePlaceholder}
                          disabled={!!googleMapsLink}
                          className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/30 disabled:opacity-50"
                        />
                      </div>
                      {analysis && analysis.province && (
                        <button 
                          type="button"
                          onClick={() => setJourneyDest(`${analysis.district}, ${analysis.province}`)}
                          disabled={!!googleMapsLink}
                          className="text-[10px] text-blue-400 mt-1 hover:underline flex items-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {t.selectFromAnalysis}: {analysis.district}, {analysis.province}
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isGeneratingJourney || (!googleMapsLink && (!journeyOrigin || !journeyDest))}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingJourney ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> {t.assessingRoute}</>
                      ) : (
                        <><ShieldCheck className="w-5 h-5" /> {googleMapsLink ? t.parseLink : t.generateJourneyPlan}</>
                      )}
                    </button>
                  </form>

                  {journeyReport && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className={`p-4 rounded-xl border ${journeyReport.overallSafetyRating === 'High Risk' ? 'bg-red-900/20 border-red-800' : 'bg-blue-900/20 border-blue-800'}`}>
                        {analysis && (
                          <div className="mb-3 flex items-center gap-2 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-tighter">
                              {t.linkedWith} {analysis.district}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-white/40">{t.routeSafety}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${journeyReport.overallSafetyRating === 'High Risk' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                            {translateRisk(journeyReport.overallSafetyRating)}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{journeyReport.routeSummary}</p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-white/40 uppercase flex items-center gap-1.5 px-1">
                          <Wind className="w-3.5 h-3.5" />
                          {t.realTimeAlerts}
                        </h4>
                        <div className={`grid gap-2 ${isFullScreen ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                          {journeyReport.weatherAlerts.map((alert, i) => (
                          <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/10">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-white">{alert.condition}</span>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold ${alert.severity === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {alert.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/60">{alert.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white/40 uppercase flex items-center gap-1.5 px-1">
                        <Car className="w-3.5 h-3.5" />
                        {t.trafficConditions}
                      </h4>
                      <div className={`grid gap-2 ${isFullScreen ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {journeyReport.trafficConditions.map((traffic, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{traffic.location}</span>
                            <span className="text-[10px] text-white/50">{traffic.status}</span>
                          </div>
                          <div className="text-orange-400 text-xs font-bold">+{traffic.delayMinutes}m</div>
                        </div>
                      ))}
                    </div>
                  </div>

                      <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl">
                        <h4 className="text-xs font-bold text-blue-400 uppercase mb-2">{t.dispatchersAdvice}</h4>
                        <p className="text-sm text-blue-100 leading-relaxed italic">"{journeyReport.adviseForDriver}"</p>
                      </div>
                    </div>
                  )}
                </>
              ) : sidebarMode === 'coaching' ? (
                <>
                  {!coachingReport && !isGeneratingCoaching ? (
                    <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-xl bg-white/5">
                      <GraduationCap className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-lg font-bold mb-2">{t.driverCoaching}</h3>
                      <p className="text-sm text-white/50 mb-6 italic">{t.coachingMotivation}</p>
                      <button
                        onClick={handleGenerateCoaching}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-5 h-5" />
                        {t.getCoaching}
                      </button>
                    </div>
                  ) : isGeneratingCoaching ? (
                    <div className="text-center py-20">
                      <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
                      <p className="text-sm text-white/60 animate-pulse">{t.generatingCoaching}</p>
                    </div>
                  ) : coachingReport && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-600/10 border border-blue-500/30 p-5 rounded-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-yellow-400" />
                          <h3 className="font-bold text-blue-100">{t.coachingSummary}</h3>
                        </div>
                        <button
                          onClick={handleGenerateCoaching}
                          disabled={isGeneratingCoaching}
                          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isGeneratingCoaching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          AI Driver Coaching (New Request)
                        </button>
                      </div>
                      <p className="text-sm text-blue-100/80 leading-relaxed mb-4 italic">"{coachingReport.summary}"</p>
                      
                      <div className="pt-4 border-t border-blue-500/20 space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">{t.riskProfile}</h4>
                          <p className="text-xs text-blue-100/70">{coachingReport.riskProfile}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Search className="w-3 h-3" /> {t.investigation}
                            </h4>
                            <p className="text-[11px] text-white/70 leading-relaxed">{coachingReport.investigationDetails}</p>
                          </div>
                          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1 text-orange-400">
                              <ShieldCheck className="w-3 h-3" /> {t.mitigationPlan}
                            </h4>
                            <p className="text-[11px] text-white/70 leading-relaxed">{coachingReport.mitigationPlan}</p>
                          </div>
                          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-1 flex items-center gap-1 text-green-400">
                              <CheckSquare className="w-3 h-3" /> {t.preventionStrategies}
                            </h4>
                            <p className="text-[11px] text-white/70 leading-relaxed">{coachingReport.preventionStrategies}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top 20 Risk Spots Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest px-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        {t.highRiskSpots20}
                      </h3>
                      <div className={`grid gap-3 ${isFullScreen ? 'sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
                        {coachingReport.highRiskSpots?.map((spot, i) => (
                          <div 
                            key={i} 
                            className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 hover:border-red-500/50 transition-all cursor-pointer group"
                            onClick={() => onPointClick(spot.latitude, spot.longitude)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors pr-2 line-clamp-1">
                                  {i + 1}. {spot.locationName}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-400 bg-red-400/10 px-1 rounded">
                                    <AlertCircle className="w-2.5 h-2.5" /> {spot.accidentCount}
                                  </div>
                                  <div className="flex items-center gap-0.5 text-[9px] font-bold text-orange-400 bg-orange-400/10 px-1 rounded">
                                    <UserIcon className="w-2.5 h-2.5" /> {spot.injuryCount}
                                  </div>
                                  <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-600/10 px-1 rounded">
                                    <Skull className="w-2.5 h-2.5" /> {spot.fatalityCount}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900 text-red-100 font-bold shrink-0">
                                {spot.hazardType || 'Point'}
                              </span>
                            </div>
                            <div className="space-y-2 mt-2">
                              <div>
                                <div className="text-[9px] font-bold text-red-400/60 uppercase">{t.mitigation}</div>
                                <p className="text-[10px] text-red-100/70 line-clamp-2">{spot.mitigationStrategy}</p>
                              </div>
                              <div>
                                <div className="text-[9px] font-bold text-green-400/60 uppercase">{t.prevention}</div>
                                <p className="text-[10px] text-green-100/70 line-clamp-2">{spot.preventionAdvice}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest px-1 flex items-center gap-2">
                        <Route className="w-4 h-4" />
                        {t.coachingModules}
                      </h3>
                      <div className={`grid gap-4 ${isFullScreen ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {coachingReport.modules.map((module, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/30 transition-colors">
                          <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                            <h4 className="font-bold text-sm text-white">{module.title}</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-800/30 font-bold uppercase">
                              {module.category}
                            </span>
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-bold text-white/30 uppercase">{t.coachingTips}</h5>
                              <ul className="space-y-2">
                                {module.tips.map((tip, ti) => (
                                  <li key={ti} className="flex gap-2 text-xs text-white/80">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-bold text-white/30 uppercase">{t.trainingSteps}</h5>
                              <div className="space-y-1.5">
                                {module.trainingSteps.map((step, si) => (
                                  <div key={si} className="text-[11px] text-white/60 bg-white/5 px-2 py-1 rounded">
                                    {si + 1}. {step}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-white/5">
                              <p className="text-[10px] italic text-blue-400/70">
                                <strong>{t.riskRelation}</strong> {module.riskRelation}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                    <div className="bg-green-900/10 border border-green-800/30 p-5 rounded-2xl">
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardCheck className="w-5 h-5 text-green-400" />
                        <h3 className="font-bold text-green-100">{t.preTripChecklist}</h3>
                      </div>
                      <ul className="space-y-3">
                        {coachingReport.personalizedChecklist.map((item, i) => (
                          <li key={i} className="flex gap-3 text-xs text-green-100/70">
                            <div className="w-5 h-5 rounded border border-green-500/30 shrink-0 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-sm bg-green-500/20" />
                            </div>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
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
                  placeholder={t.provincePlaceholder}
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
                  placeholder={t.districtPlaceholder}
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-white/40" />
                  {t.riskFactorsTitle}
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
                  placeholder={t.customRiskPlaceholder}
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
                  {t.localObservations}
                </div>
              </label>
              <textarea
                value={historicalData}
                onChange={(e) => setHistoricalData(e.target.value)}
                placeholder={t.localObservationsPlaceholder}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-y text-sm text-white placeholder:text-white/30"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 md:py-2.5 px-4 rounded-xl md:rounded-md transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.analyzingText}
                  </>
                ) : (
                  t.analyzeAreaRisks
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="px-3 py-2.5 border border-white/10 text-white/60 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
                title={t.resetForm}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            {isLoading && (
              <p className="text-[10px] text-center text-white/40 mt-2 animate-pulse flex items-center justify-center gap-1">
                <Navigation className="w-3 h-3" />
                {t.pullingData}
              </p>
            )}
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-800/30 rounded-md">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-200">{t.analysisFailed}</h3>
                  <p className="text-sm text-red-300 mt-1">{error}</p>
                  
                  <div className="mt-3 pt-3 border-t border-red-800/30">
                    <p className="text-xs font-semibold text-red-200 mb-1">{t.commonCauses}</p>
                    <ul className="text-xs text-red-300 list-disc list-inside space-y-1">
                      <li>{t.cause1}</li>
                      <li>{t.cause2}</li>
                      <li>{t.cause3}</li>
                      <li>{t.cause4}</li>
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
                      {analysis.workOrderName || t.analysisSummary}
                    </h2>
                    {analysis.workOrderName && (
                      <span className="text-xs text-white/40">
                        {analysis.district}, {analysis.province}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 print-hide flex-wrap">
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
                      title={t.downloadPDF}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" /> {t.downloadPDF}
                    </button>
                  </div>
                </div>
                <div className={`p-4 rounded-lg border ${getRiskColor(analysis.overallRisk)} mb-4 print:border-gray-300 print:bg-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{t.overallAreaRisk}</span>
                    <span className="font-bold uppercase tracking-wider text-sm px-2 py-1 bg-black/20 rounded">{translateRisk(analysis.overallRisk)}</span>
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
                <h2 className="text-lg font-semibold text-white mb-3">{t.areaSafetyPoints} ({analysis.blackSpots.length})</h2>
                <div className={`grid gap-4 ${isFullScreen ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
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
                              {spot.confirmations} {t.verified}
                            </div>
                          ) : null}
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${getRiskColor(spot.riskLevel)}`}>
                          {spot.riskLevel}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-3 mb-2 text-center">
                        <div className="bg-white/5 border border-white/10 p-1.5 rounded-md">
                          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{t.accidents}</div>
                          <div className="font-bold text-white">{spot.accidentCount}</div>
                        </div>
                        <div className="bg-orange-900/20 border border-orange-800/30 p-1.5 rounded-md">
                          <div className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">{t.injuries}</div>
                          <div className="font-bold text-orange-300">{spot.injuryCount}</div>
                        </div>
                        <div className="bg-red-900/20 border border-red-800/30 p-1.5 rounded-md">
                          <div className="text-[10px] uppercase tracking-wider text-red-400 font-semibold">{t.fatalities}</div>
                          <div className="font-bold text-red-300">{spot.fatalityCount}</div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">{t.riskFactorsLabel}</h4>
                        <ul className="list-disc list-inside text-sm text-white/80 space-y-0.5">
                          {spot.riskFactors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="mt-3 bg-blue-900/20 p-3 rounded-md border border-blue-800/30">
                        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">{t.actionableAdvice}</h4>
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
                      {t.recentAccidents} ({analysis.recentAccidents.length})
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
                      {t.aiMoreDetail}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {severityStats && (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{t.severityMix}</h4>
                          <button 
                            onClick={handleGenerateTrendAnalysis}
                            disabled={isGeneratingTrends}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isGeneratingTrends ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <BarChart3 className="w-2.5 h-2.5" />}
                            {t.runTrendAnalysis}
                          </button>
                        </div>
                        <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-2">
                          {Object.entries(severityStats).map(([key, val]) => {
                            const total = analysis.recentAccidents.length;
                            const pct = (val / total) * 100;
                            if (pct === 0) return null;
                            const colors: any = { Fatal: 'bg-red-500', Major: 'bg-orange-500', Minor: 'bg-yellow-500' };
                            return <div key={key} style={{ width: `${pct}%` }} className={colors[key]} />;
                          })}
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-red-400 font-bold">{t.fatalities}: {severityStats.Fatal}</span>
                          <span className="text-orange-400 font-bold">{t.major}: {severityStats.Major}</span>
                          <span className="text-yellow-400 font-bold">{t.minor}: {severityStats.Minor}</span>
                        </div>
                      </div>
                    )}
                    <div className={`grid gap-4 ${isFullScreen ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
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
                                {acc.confirmations} {t.verified}
                              </div>
                            ) : null}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-900/40 text-red-200 rounded uppercase border border-red-800/30">
                            {translateSeverity(acc.severity)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
                          <History className="w-3 h-3" />
                          {acc.timestamp}
                        </div>
                        <p className="text-sm text-white/70 italic mb-3">"{acc.description}"</p>
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">{t.type}: {acc.type}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateDetailedReport(acc);
                            }}
                            disabled={isGeneratingReport}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-900/30 border border-red-800/30 rounded transition-all disabled:opacity-50"
                          >
                            <Info className="w-3 h-3" />
                            {t.caseDetail}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    )}
    </div>
  </div>
)}
</div>
  

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] w-full max-w-sm rounded-xl shadow-2xl p-6 border border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">{t.deleteAnalysisTitle}</h3>
            </div>
            <p className="text-white/60 mb-6 leading-relaxed">
              {t.deleteAnalysisConfirm}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  onDeleteAnalysis(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report Modal */}
      {isReportModalOpen && detailedReport && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0f0f] w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-blue-900/20 print:border-b-2 print:border-gray-800 print:bg-white">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400 print:text-gray-900" />
                <h2 className="text-lg font-semibold text-white print:text-gray-900">{t.detailedReportTitle}</h2>
              </div>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors print-hide"
              >
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar print:p-0 print:overflow-visible">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-white/60 print-hide">
                   <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                   <p className="font-medium animate-pulse">{t.generatingReport}</p>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm prose-blue max-w-none text-white/90 print:text-black">
                  <div className="markdown-body print:text-black">
                    <ReactMarkdown>{detailedReport}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5 flex flex-wrap justify-between items-center gap-3 print-hide">
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
                <h2 className="text-lg font-semibold text-white">{t.localObservations}</h2>
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
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
