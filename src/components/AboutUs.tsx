import React from 'react';
import { ShieldCheck, Mail, Globe, Info, Target, Users, MapPin, ExternalLink, ChevronLeft } from 'lucide-react';

interface AboutUsProps {
  onBack: () => void;
}

export const AboutUs: React.FC<AboutUsProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-4 sticky top-0 z-20 backdrop-blur-md">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
          title="Back to Map"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold tracking-tight">About Us</h1>
        </div>
      </div>

      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12">
        {/* Mission Statement */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-400">
            <Target className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wider">Our Mission</h2>
          </div>
          <p className="text-lg text-white/80 leading-relaxed">
            Our mission is to leverage advanced Artificial Intelligence to make Thailand's roads safer for everyone. 
            By analyzing real-time accident data, historical black spots, and local environmental factors, 
            we provide actionable insights to drivers, logistics companies, and authorities to prevent accidents before they happen.
          </p>
        </section>

        {/* Application Purpose */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-3 text-blue-400">
              <Info className="w-6 h-6" />
              <h2 className="text-xl font-bold">What is Road Safety AI?</h2>
            </div>
            <p className="text-white/70 leading-relaxed">
              Road Safety AI is a comprehensive analysis tool designed to identify high-risk zones (Black Spots) 
              and track recent traffic incidents across Thailand. It uses the Gemini 3.1 Pro model to synthesize 
              data from official reports, local news, and community feedback.
            </p>
          </div>
          <div className="glass-card space-y-4">
            <div className="flex items-center gap-3 text-blue-400">
              <Users className="w-6 h-6" />
              <h2 className="text-xl font-bold">Who is it for?</h2>
            </div>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>Professional drivers and logistics managers.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>Road safety authorities and urban planners.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>Daily commuters looking for safer routes.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* The Company */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-blue-400">
            <Globe className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wider">The Company</h2>
          </div>
          <div className="glass-dark p-8 rounded-3xl border border-white/10">
            <h3 className="text-2xl font-bold mb-4">Road Safety AI Solutions</h3>
            <p className="text-white/70 mb-6 leading-relaxed">
              We are a technology-driven organization focused on public safety and data transparency. 
              Our team consists of data scientists, road safety experts, and software engineers dedicated 
              to reducing traffic fatalities in Southeast Asia through innovative digital solutions.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <MapPin className="w-4 h-4" />
                Bangkok, Thailand
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <ExternalLink className="w-4 h-4" />
                www.thairsc.com (Data Partner)
              </div>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="space-y-6 pb-12">
          <div className="flex items-center gap-3 text-blue-400">
            <Mail className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wider">Contact Us</h2>
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
                <div className="text-sm text-white/50 font-medium">Email Support</div>
                <div className="text-lg font-bold">Nitislb@gmail.com</div>
              </div>
            </a>
            <div className="flex items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-white/50 font-medium">Region</div>
                <div className="text-lg font-bold">Thailand (National)</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
