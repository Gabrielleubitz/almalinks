import React from 'react';
import { Users, UserCheck, Clock, Download } from 'lucide-react';

interface StatsCardsProps {
  stats: {
    total: number;
    registered: number;
    attended: number;
  };
  onStatClick?: (type: 'total' | 'registered' | 'attended') => void;
  onExportClick?: () => void;
  selectedEventName?: string;
}

const StatsCards: React.FC<StatsCardsProps> = ({ 
  stats, 
  onStatClick, 
  onExportClick,
  selectedEventName 
}) => {
  const cards = [
    {
      icon: Users,
      value: stats.total,
      label: 'Total Registered',
      color: 'text-brand-light',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-50',
      type: 'total' as const
    },
    {
      icon: Clock,
      value: stats.registered,
      label: 'Awaiting Check-in',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      hoverColor: 'hover:bg-yellow-100',
      type: 'registered' as const
    },
    {
      icon: UserCheck,
      value: stats.attended,
      label: 'Checked In',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverColor: 'hover:bg-green-100',
      type: 'attended' as const
    }
  ];

  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
      {/* Header with Export Button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Registration Statistics</h2>
        {onExportClick && selectedEventName && (
          <button
            onClick={onExportClick}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2"
            title="Export to Excel"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
        )}
      </div>

      {selectedEventName && (
        <div className="mb-6 p-3 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">
            Showing statistics for: <span className="font-semibold text-gray-900">{selectedEventName}</span>
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((card, index) => {
          const IconComponent = card.icon;
          const isClickable = onStatClick && card.value > 0;
          
          return (
            <div
              key={index}
              className={`text-center p-6 rounded-2xl transition-all duration-300 ${card.bgColor} ${
                isClickable 
                  ? `cursor-pointer ${card.hoverColor} hover:shadow-md transform hover:scale-105` 
                  : ''
              }`}
              onClick={isClickable ? () => onStatClick(card.type) : undefined}
              title={isClickable ? `Click to view ${card.label.toLowerCase()} users` : undefined}
            >
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isClickable ? 'bg-white shadow-sm' : 'bg-white/50'
              }`}>
                <IconComponent className={`h-8 w-8 ${card.color}`} />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{card.value}</div>
              <div className="text-gray-700 font-medium">{card.label}</div>
              {isClickable && (
                <div className="text-xs text-gray-500 mt-2">Click to view details</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatsCards;