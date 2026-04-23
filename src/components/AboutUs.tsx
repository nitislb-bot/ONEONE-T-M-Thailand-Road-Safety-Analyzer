import React from 'react';
import { ShieldCheck, Mail, Globe, Info, Target, Users, MapPin, ExternalLink, ChevronLeft } from 'lucide-react';

import { Locale, translations } from '../i18n';

interface AboutUsProps {
  onBack: () => void;
  locale: Locale;
}

export const AboutUs: React.FC<AboutUsProps> = ({ onBack, locale }) => {
  const t = translations[locale];
  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-4 sticky top-0 z-20 backdrop-blur-md">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
          title={t.backToMap}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold tracking-tight">{t.aboutTitle}</h1>
        </div>
      </div>

      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12">
        {/* Mission Statement */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-400">
            <Target className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wider">{t.ourMission}</h2>
          </div>
          <p className="text-lg text-white/80 leading-relaxed">
            {t.missionStatement}
          </p>
        </section>

        {/* Application Purpose */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-3 text-blue-400">
              <Info className="w-6 h-6" />
              <h2 className="text-xl font-bold">{t.whatIsIt}</h2>
            </div>
            <p className="text-white/70 leading-relaxed">
              {t.whatIsItDesc}
            </p>
          </div>
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-3 text-blue-400">
              <Users className="w-6 h-6" />
              <h2 className="text-xl font-bold">{t.whoIsItFor}</h2>
            </div>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>{t.professionalDrivers}</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>{t.authorities}</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>{t.commuters}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* The Company */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-blue-400">
            <Globe className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wider">{t.theCompany}</h2>
          </div>
          <div className="glass-dark p-8 rounded-3xl border border-white/10">
            <h3 className="text-2xl font-bold mb-4">{t.solutions}</h3>
            <p className="text-white/70 mb-6 leading-relaxed">
              {t.companyDesc}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <MapPin className="w-4 h-4" />
                {t.locationTH}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <ExternalLink className="w-4 h-4" />
                www.thairsc.com ({t.dataPartner})
              </div>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="space-y-6 pb-12">
          <div className="flex items-center gap-3 text-blue-400">
            <Mail className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wider">{t.contactUs}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <a 
              href="mailto:Nitislb@gmail.com" 
              className="flex items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
            >
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-white/50 font-medium">{t.emailSupport}</div>
                <div className="text-lg font-bold">Nitislb@gmail.com</div>
              </div>
            </a>
            <div className="flex items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-white/50 font-medium">{t.region}</div>
                <div className="text-lg font-bold">{t.regionNational}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
