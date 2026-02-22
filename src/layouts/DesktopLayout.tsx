import React, { ReactNode } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface DesktopLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

/**
 * DesktopLayout - Wraps the existing desktop experience
 * Uses the current Header and Footer components for consistency
 * Maintains the existing spacious design patterns
 */
const DesktopLayout: React.FC<DesktopLayoutProps> = ({ 
  children, 
  showHeader = true, 
  showFooter = true 
}) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Existing Desktop Header */}
      {showHeader && <Header />}
      
      {/* Main Content Area */}
      <main className={`flex-1 ${showHeader ? 'pt-[var(--content-offset-top)]' : ''}`}>
        {children}
      </main>
      
      {/* Existing Desktop Footer */}
      {showFooter && <Footer />}
    </div>
  );
};

export default DesktopLayout;