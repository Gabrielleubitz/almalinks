import React from 'react';

export default function CommunityHomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="border border-slate-800 rounded-xl bg-slate-900/40 backdrop-blur px-6 py-8">
          <div className="text-xs tracking-widest uppercase text-amber-300/90">Altius Community</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Private network for SFO principals</h1>
          <p className="mt-3 text-slate-300 leading-relaxed">
            This namespace is feature-flagged and group-scoped. Next up: group feed, onboarding, and membership-based permissions.
          </p>
        </div>
      </div>
    </div>
  );
}

