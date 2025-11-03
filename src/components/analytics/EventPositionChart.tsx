import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { PieChart, Users } from 'lucide-react';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// Position mapping for display
const positionLabels: Record<string, string> = {
  'investor': 'Investor',
  'c_level': 'C-Level Executive',
  'vp_level': 'VP Level',
  'director': 'Director',
  'senior_manager': 'Senior Manager',
  'manager': 'Manager',
  'senior_contributor': 'Senior Contributor',
  'individual_contributor': 'Individual Contributor',
  'junior_level': 'Junior Level',
  'founder': 'Founder',
  'consultant': 'Consultant',
  'student': 'Student',
  'other': 'Other'
};

// Chart colors - diverse palette for all position types
const chartColors = [
  'rgba(185, 28, 28, 0.8)',    // Red-700 (Founder)
  'rgba(37, 99, 235, 0.8)',    // Blue-600 (Other)
  'rgba(16, 185, 129, 0.8)',   // Emerald-500 (VP Level)
  'rgba(168, 85, 247, 0.8)',   // Purple-500 (C-Level)
  'rgba(245, 158, 11, 0.8)',   // Amber-500 (Director)
  'rgba(236, 72, 153, 0.8)',   // Pink-500 (Senior Manager)
  'rgba(6, 182, 212, 0.8)',    // Cyan-500 (Manager)
  'rgba(139, 69, 19, 0.8)',    // Brown-600 (Senior Contributor)
  'rgba(75, 85, 99, 0.8)',     // Gray-600 (Individual Contributor)
  'rgba(34, 197, 94, 0.8)',    // Green-500 (Junior Level)
  'rgba(249, 115, 22, 0.8)',   // Orange-500 (Consultant)
  'rgba(99, 102, 241, 0.8)',   // Indigo-500 (Student)
  'rgba(217, 70, 239, 0.8)'    // Fuchsia-500 (Investor)
];

interface EventPositionChartProps {
  eventId: string;
  className?: string;
}

const EventPositionChart: React.FC<EventPositionChartProps> = ({ eventId, className = '' }) => {
  const [positionData, setPositionData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRegistrations, setTotalRegistrations] = useState(0);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      setError('No event selected');
      return;
    }

    console.log(`📊 Starting to analyze event: ${eventId}`);
    setLoading(true);
    setError(null);

    // Reference to event registrations
    const registrationsRef = collection(db, 'events', eventId, 'registrations');
    
    // Create query for this event's registrations
    const q = query(registrationsRef);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        try {
          console.log(`📊 Processing ${snapshot.docs.length} registrations for analytics`);
          
          if (snapshot.docs.length === 0) {
            console.log(`⚠️ No registrations found for event ${eventId}`);
            setPositionData({});
            setTotalRegistrations(0);
            setLoading(false);
            return;
          }
          
          // Initialize position counts
          const positions: Record<string, number> = {};
          let total = 0;
          
          // Process each registration
          for (const regDoc of snapshot.docs) {
            const regData = regDoc.data();
            total++;
            
            let position = regData.position;
            
            // The user ID is likely the document ID itself
            const userId = regData.userId || regDoc.id;
            
            // If no position in registration, fetch from user doc using the userId
            if (!position || position === '' || position === 'other') {
              try {
                const userDocRef = doc(db, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                  const userData = userDocSnap.data();
                  
                  if (userData.position && userData.position !== '' && userData.position !== 'other') {
                    position = userData.position;
                    console.log(`✅ Found position "${position}" for user ${userId}`);
                  }
                }
              } catch (userErr) {
                console.error(`❌ Error fetching user doc for ${userId}:`, userErr);
              }
            }
            
            // Final position validation
            if (!position || position === '' || position === null || position === undefined) {
              position = 'other';
            }
            
            // Increment count for this position
            positions[position] = (positions[position] || 0) + 1;
          }
          
          console.log(`📊 Position breakdown:`, positions);
          
          setPositionData(positions);
          setTotalRegistrations(total);
          setLoading(false);
          
        } catch (err: any) {
          console.error('❌ Error processing position data:', err);
          setError('Error processing data: ' + err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('❌ Error in snapshot listener:', err);
        setError('Error fetching data: ' + err.message);
        setLoading(false);
      }
    );
    
    // Clean up listener on unmount
    return () => unsubscribe();
  }, [eventId]);

  // Prepare chart data
  const chartData = {
    labels: Object.keys(positionData).map(key => positionLabels[key] || key),
    datasets: [
      {
        data: Object.values(positionData),
        backgroundColor: chartColors.slice(0, Object.keys(positionData).length),
        borderColor: chartColors.map(color => color.replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const value = data.datasets[0].data[i];
                const percentage = totalRegistrations > 0 ? ((value / totalRegistrations) * 100).toFixed(1) : '0';
                return {
                  text: `${label} (${value}, ${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const percentage = totalRegistrations > 0 ? ((value / totalRegistrations) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: 'Attendee Positions Breakdown',
        font: {
          size: 16,
          weight: 'bold'
        },
        color: '#1f2937'
      }
    },
    backgroundColor: 'white'
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-3xl shadow-xl p-6 border border-gray-100 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <PieChart className="h-5 w-5 text-brand-light" />
          <h3 className="text-lg font-semibold text-gray-900">Attendee Positions Breakdown</h3>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-3xl shadow-xl p-6 border border-gray-100 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <PieChart className="h-5 w-5 text-brand-light" />
          <h3 className="text-lg font-semibold text-gray-900">Attendee Positions Breakdown</h3>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (totalRegistrations === 0) {
    return (
      <div className={`bg-white rounded-3xl shadow-xl p-6 border border-gray-100 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <PieChart className="h-5 w-5 text-brand-light" />
          <h3 className="text-lg font-semibold text-gray-900">Attendee Positions Breakdown</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-64">
          <Users className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-center">No registrations yet for this event</p>
          <p className="text-gray-400 text-sm text-center mt-2">Analytics will appear as attendees register</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 border border-gray-100 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <PieChart className="h-5 w-5 text-brand-light" />
          <h3 className="text-lg font-semibold text-gray-900">Attendee Positions Breakdown</h3>
        </div>
        <div className="text-sm text-gray-500">
          Total: {totalRegistrations} {totalRegistrations === 1 ? 'attendee' : 'attendees'}
        </div>
      </div>
      
      <div className="h-64 md:h-80">
        <Pie data={chartData} options={chartOptions} />
      </div>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        Live data - updates automatically as new registrations come in
      </div>
    </div>
  );
};

export default EventPositionChart;