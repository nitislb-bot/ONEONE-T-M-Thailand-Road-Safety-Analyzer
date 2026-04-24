/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Sidebar } from './components/Sidebar';
import { MapComponent } from './components/MapComponent';
import { AboutUs } from './components/AboutUs';
import { SafetyAnalysis, BlackSpot, Accident, JourneySafetyReport, DriverCoachingReport } from './services/geminiService';
import { auth, db, signIn, signOut, analysesCollection, journeyPlansCollection, coachingReportsCollection, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { onSnapshot, query, orderBy, limit, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { LogIn, LogOut, ShieldAlert, RefreshCw, Info, Languages, MapPin } from 'lucide-react';
import { Locale, translations } from './i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

// Error Boundary Component
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const errorLocale = (window.location.search.includes('lang=th') || navigator.language.startsWith('th')) ? 'th' : 'en';
    const et = translations[errorLocale as Locale] || translations.en;
    
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
          <div className="glass-dark p-8 rounded-2xl max-w-md w-full border-t-4 border-red-500/50">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <ShieldAlert className="w-8 h-8" />
              <h2 className="text-2xl font-bold tracking-tight">{et.systemError}</h2>
            </div>
            <p className="text-white/70 mb-6 font-medium">
              {et.unexpectedError}
            </p>
            <div className="bg-black/40 p-4 rounded-xl mb-6 overflow-auto max-h-40 border border-white/5">
              <code className="text-xs text-red-400/80 whitespace-pre-wrap">
                {this.state.errorInfo}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-red-500/30"
            >
              <RefreshCw className="w-5 h-5" />
              {et.reloadApp}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [analysis, setAnalysis] = useState<SafetyAnalysis | null>(null);
  const [history, setHistory] = useState<SafetyAnalysis[]>([]);
  const [journeyHistory, setJourneyHistory] = useState<JourneySafetyReport[]>([]);
  const [coachingHistory, setCoachingHistory] = useState<DriverCoachingReport[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number, lng: number } | null>(null);
  const [view, setView] = useState<'map' | 'about'>('map');
  const [locale, setLocale] = useState<Locale>('th');
  const [activeTab, setActiveTab] = useState<'map' | 'sidebar'>('sidebar');
  const [isSidebarFullScreen, setIsSidebarFullScreen] = useState(false);
  const [requestedAccident, setRequestedAccident] = useState<Accident | null>(null);
  const [journeyPlan, setJourneyPlan] = useState<JourneySafetyReport | null>(null);

  const t = translations[locale];

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore History Listener
  useEffect(() => {
    if (!isAuthReady || !user) {
      setHistory([]);
      return;
    }

    const q = query(analysesCollection, orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newHistory = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SafetyAnalysis[];
      setHistory(newHistory);
      
      // If current analysis is in history, update it to reflect shared changes
      if (analysis) {
        const updatedCurrent = newHistory.find(h => h.id === analysis.id);
        if (updatedCurrent) {
          setAnalysis(updatedCurrent);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'analyses');
    });

    const qJourney = query(journeyPlansCollection, orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeJourney = onSnapshot(qJourney, (snapshot) => {
      const newHistory = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as JourneySafetyReport[];
      setJourneyHistory(newHistory);
    });

    const qCoaching = query(coachingReportsCollection, orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeCoaching = onSnapshot(qCoaching, (snapshot) => {
      const newHistory = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DriverCoachingReport[];
      setCoachingHistory(newHistory);
    });

    return () => {
      unsubscribe();
      unsubscribeJourney();
      unsubscribeCoaching();
    };
  }, [isAuthReady, user, analysis?.id]);

  const handleAnalysisComplete = async (result: SafetyAnalysis) => {
    if (!user) return;
    
    const id = Date.now().toString();
    const newAnalysis: SafetyAnalysis = {
      ...result,
      id,
      timestamp: Date.now(),
      createdBy: user.displayName || user.email || 'Unknown',
      lastUpdatedBy: user.displayName || user.email || 'Unknown'
    };

    try {
      await setDoc(doc(db, 'analyses', id), newAnalysis);
      setAnalysis(newAnalysis);
      // Switch to map on mobile when analysis is complete
      setActiveTab('map');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `analyses/${id}`);
    }
  };

  const handleJourneyPlanComplete = async (plan: JourneySafetyReport) => {
    if (!user) return;
    const id = Date.now().toString();
    const newPlan: JourneySafetyReport = {
      ...plan,
      id,
      timestamp: Date.now(),
      createdBy: user.displayName || user.email || 'Unknown'
    };
    try {
      await setDoc(doc(db, 'journey_plans', id), newPlan);
      setJourneyPlan(newPlan);
      setActiveTab('map');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `journey_plans/${id}`);
    }
  };

  const handleCoachingReportComplete = async (report: DriverCoachingReport) => {
    if (!user) return;
    const id = Date.now().toString();
    const newReport: DriverCoachingReport = {
      ...report,
      id,
      timestamp: Date.now(),
      createdBy: user.displayName || user.email || 'Unknown',
      locationContext: analysis?.workOrderName || analysis?.district || 'Unknown Location'
    };
    try {
      await setDoc(doc(db, 'coaching_reports', id), newReport);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `coaching_reports/${id}`);
    }
  };

  const handleUpdateSpot = async (index: number, updatedSpot: BlackSpot) => {
    if (!analysis || !user) return;
    const newSpots = [...analysis.blackSpots];
    newSpots[index] = updatedSpot;
    
    try {
      await updateDoc(doc(db, 'analyses', analysis.id!), {
        blackSpots: newSpots,
        lastUpdatedBy: user.displayName || user.email || 'Unknown'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `analyses/${analysis.id}`);
    }
  };

  const handleDeleteSpot = async (index: number) => {
    if (!analysis || !user) return;
    const newSpots = analysis.blackSpots.filter((_, i) => i !== index);
    
    try {
      await updateDoc(doc(db, 'analyses', analysis.id!), {
        blackSpots: newSpots,
        lastUpdatedBy: user.displayName || user.email || 'Unknown'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `analyses/${analysis.id}`);
    }
  };

  const handleAddSpot = async (newSpot: BlackSpot) => {
    if (!analysis || !user) return;
    const newSpots = [...analysis.blackSpots, newSpot];
    
    try {
      await updateDoc(doc(db, 'analyses', analysis.id!), {
        blackSpots: newSpots,
        lastUpdatedBy: user.displayName || user.email || 'Unknown'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `analyses/${analysis.id}`);
    }
  };

  const handleUpdateAccident = async (index: number, updatedAccident: Accident) => {
    if (!analysis || !user) return;
    const newAccidents = [...analysis.recentAccidents];
    newAccidents[index] = updatedAccident;
    
    try {
      await updateDoc(doc(db, 'analyses', analysis.id!), {
        recentAccidents: newAccidents,
        lastUpdatedBy: user.displayName || user.email || 'Unknown'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `analyses/${analysis.id}`);
    }
  };

  const handleDeleteAccident = async (index: number) => {
    if (!analysis || !user) return;
    const newAccidents = analysis.recentAccidents.filter((_, i) => i !== index);
    
    try {
      await updateDoc(doc(db, 'analyses', analysis.id!), {
        recentAccidents: newAccidents,
        lastUpdatedBy: user.displayName || user.email || 'Unknown'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `analyses/${analysis.id}`);
    }
  };

  const handleDeleteAnalysis = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'analyses', id));
      if (analysis?.id === id) {
        setAnalysis(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `analyses/${id}`);
    }
  };

  const handleLoadHistory = (item: SafetyAnalysis) => {
    setAnalysis(item);
    setActiveTab('map');
  };

  const handlePointClick = (lat: number, lng: number) => {
    setSelectedPoint({ lat, lng });
    setActiveTab('map');
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#050505]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505] p-4">
        <div className="absolute top-6 right-6 flex gap-2">
          <button 
            onClick={() => setLocale(locale === 'en' ? 'th' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
          >
            <Languages className="w-3.5 h-3.5" />
            {locale === 'en' ? 'ไทย' : 'English'}
          </button>
        </div>
        
        <div className="max-w-md w-full glass-dark p-10 rounded-3xl text-center">
          <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-blue-500/20">
            <ShieldAlert className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">{t.signInTitle}</h1>
          <p className="text-white/60 mb-10 font-medium leading-relaxed">
            {t.signInDesc}
          </p>
          <button
            onClick={signIn}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/20 active:scale-95"
          >
            <LogIn className="w-6 h-6" />
            {t.signInButton}
          </button>
          <button 
            onClick={() => setView('about')}
            className="mt-6 text-sm text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Info className="w-4 h-4" />
            {t.aboutTitle}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'about') {
    return <AboutUs onBack={() => setView('map')} locale={locale} />;
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-[#050505] overflow-hidden font-sans print:flex-col print:h-auto print:bg-white print:overflow-visible">
        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex items-center justify-center p-2 bg-[#0a0a0a] border-t border-white/10 gap-4 z-50 order-last shrink-0">
          <button 
            onClick={() => setActiveTab('sidebar')}
            className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'sidebar' 
                ? 'bg-blue-600/20 text-blue-400 font-bold' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wider">{t.analysis}</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all ${
              activeTab === 'map' 
                ? 'bg-blue-600/20 text-blue-400 font-bold' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wider">{t.mapView}</span>
          </button>
        </div>

        <div className={`${activeTab === 'sidebar' ? 'flex' : 'hidden md:flex'} ${isSidebarFullScreen ? 'w-full' : 'w-full md:w-96'} flex-col md:h-full shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out`}>
          <Sidebar 
            analysis={analysis}
            onAnalysisComplete={handleAnalysisComplete} 
            history={history}
            journeyHistory={journeyHistory}
            coachingHistory={coachingHistory}
            onLoadHistory={handleLoadHistory}
            onLoadJourneyHistory={(item) => {
              setJourneyPlan(item);
              setActiveTab('map');
            }}
            onLoadCoachingHistory={(item) => {
              // Sidebar state will handle viewing this
            }}
            onPointClick={handlePointClick}
            onDeleteAnalysis={handleDeleteAnalysis}
            user={user}
            onSignOut={signOut}
            onShowAbout={() => setView('about')}
            locale={locale}
            setLocale={setLocale}
            requestedAccident={requestedAccident}
            clearRequestedAccident={() => setRequestedAccident(null)}
            onJourneyPlanComplete={handleJourneyPlanComplete}
            onCoachingReportComplete={handleCoachingReportComplete}
            isFullScreen={isSidebarFullScreen}
            toggleFullScreen={() => setIsSidebarFullScreen(!isSidebarFullScreen)}
          />
        </div>
        
        <div className={`flex-1 relative w-full h-full print:h-[500px] print:flex-none print:block print:w-full print:mb-8 print:break-inside-avoid print:border-2 print:border-gray-200 ${
          activeTab === 'map' ? 'block' : 'hidden md:block'
        } ${isSidebarFullScreen ? 'md:hidden' : 'md:block'}`}>
          <MapComponent 
            blackSpots={analysis?.blackSpots || []} 
            recentAccidents={analysis?.recentAccidents || []}
            onUpdateSpot={handleUpdateSpot}
            onUpdateAccident={handleUpdateAccident}
            onDeleteSpot={handleDeleteSpot}
            onDeleteAccident={handleDeleteAccident}
            onAddSpot={handleAddSpot}
            isAnalysisActive={!!analysis}
            selectedPoint={selectedPoint}
            locale={locale}
            onRequestDetailedReport={(acc) => {
              setRequestedAccident(acc);
              setActiveTab('sidebar'); // Switch to sidebar so user sees the loading state/modal
            }}
            journeyPlan={journeyPlan}
            user={user}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
