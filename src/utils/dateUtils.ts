/**
 * Format message timestamp for display
 * Shows time for today, date for older messages
 */
export const formatMessageTime = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // If message is from today, show only time
  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If message is from yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (messageDate.getTime() === yesterday.getTime()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // If message is from this week, show day name
  const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise show full date
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

/**
 * Check if two messages should be grouped together (same sender, within 5 minutes)
 */
export const shouldGroupMessages = (msg1: any, msg2: any, currentUserId: string): boolean => {
  if (!msg1 || !msg2) return false;
  if (msg1.type === 'system' || msg2.type === 'system') return false;
  if (msg1.userId !== msg2.userId) return false;
  
  const date1 = msg1.createdAt?.toDate ? msg1.createdAt.toDate() : new Date(msg1.createdAt);
  const date2 = msg2.createdAt?.toDate ? msg2.createdAt.toDate() : new Date(msg2.createdAt);
  
  const timeDiff = Math.abs(date2.getTime() - date1.getTime());
  return timeDiff < 5 * 60 * 1000; // 5 minutes
};

