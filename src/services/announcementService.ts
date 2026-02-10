import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { nanoid } from 'nanoid';

export interface AnnouncementData {
  id: string;
  message: string;
  timestamp: any;
  createdBy: string;
  active: boolean;
  updatedAt?: any;
  reactions?: {
    "👍": { count: number, userIds: string[] },
    "❤️": { count: number, userIds: string[] },
    "🔥": { count: number, userIds: string[] },
    "👑": { count: number, userIds: string[] },
    "😊": { count: number, userIds: string[] }
  };
}

export type EmojiReaction = "👍" | "❤️" | "🔥" | "👑" | "😊";

export class AnnouncementService {
  // Create a new announcement
  static async createAnnouncement(message: string, adminUid: string): Promise<string> {
    try {
      const announcementId = nanoid(12);
      
      const newAnnouncement: AnnouncementData = {
        id: announcementId,
        message: message.trim(),
        timestamp: serverTimestamp(),
        createdBy: adminUid,
        active: true,
        reactions: {
          "👍": { count: 0, userIds: [] },
          "❤️": { count: 0, userIds: [] },
          "🔥": { count: 0, userIds: [] },
          "👑": { count: 0, userIds: [] },
          "😊": { count: 0, userIds: [] }
        }
      };

      await setDoc(doc(db, 'announcements', announcementId), newAnnouncement);
      console.log('✅ Announcement created successfully:', announcementId);
      return announcementId;
    } catch (error) {
      console.error('❌ Error creating announcement:', error);
      throw error;
    }
  }

  // Get all announcements (for admin)
  static async getAllAnnouncements(): Promise<AnnouncementData[]> {
    try {
      const announcementsRef = collection(db, 'announcements');
      const q = query(announcementsRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnnouncementData[];
    } catch (error) {
      console.error('❌ Error fetching all announcements:', error);
      return [];
    }
  }

  // Get active announcements for members (limited to 3 most recent)
  static async getActiveAnnouncements(): Promise<AnnouncementData[]> {
    try {
      const announcementsRef = collection(db, 'announcements');
      // First get all announcements, then filter and sort in memory to avoid composite index requirement
      const snapshot = await getDocs(announcementsRef);
      
      const allAnnouncements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnnouncementData[];
      
      // Filter active announcements and sort by timestamp in memory
      const activeAnnouncements = allAnnouncements
        .filter(announcement => announcement.active === true)
        .sort((a, b) => {
          // Handle timestamp comparison
          const timestampA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const timestampB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return timestampB.getTime() - timestampA.getTime(); // Descending order
        })
        .slice(0, 3); // Limit to 3 most recent
      
      return activeAnnouncements;
    } catch (error) {
      console.error('❌ Error fetching active announcements:', error);
      return [];
    }
  }

  // Update announcement
  static async updateAnnouncement(announcementId: string, message: string): Promise<void> {
    try {
      const docRef = doc(db, 'announcements', announcementId);
      await updateDoc(docRef, { 
        message: message.trim(),
        updatedAt: serverTimestamp()
      });
      console.log('✅ Announcement updated:', announcementId);
    } catch (error) {
      console.error('❌ Error updating announcement:', error);
      throw error;
    }
  }

  // Toggle announcement active status
  static async toggleAnnouncementStatus(announcementId: string, active: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'announcements', announcementId);
      await updateDoc(docRef, { 
        active,
        updatedAt: serverTimestamp()
      });
      console.log('✅ Announcement status updated:', announcementId, active);
    } catch (error) {
      console.error('❌ Error updating announcement status:', error);
      throw error;
    }
  }

  // Delete announcement
  static async deleteAnnouncement(announcementId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'announcements', announcementId));
      console.log('✅ Announcement deleted successfully:', announcementId);
    } catch (error) {
      console.error('❌ Error deleting announcement:', error);
      throw error;
    }
  }

  // Add or toggle emoji reaction (one per user)
  static async toggleReaction(announcementId: string, emoji: EmojiReaction, userId: string): Promise<void> {
    try {
      // Get the announcement document
      const docRef = doc(db, 'announcements', announcementId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Announcement not found');
      }
      
      const announcement = docSnap.data() as AnnouncementData;
      const reactions = announcement.reactions || {
        "👍": { count: 0, userIds: [] },
        "❤️": { count: 0, userIds: [] },
        "🔥": { count: 0, userIds: [] },
        "👑": { count: 0, userIds: [] },
        "😊": { count: 0, userIds: [] }
      };
      
      // Check if user has already reacted with this emoji
      const hasReactedWithThisEmoji = reactions[emoji]?.userIds.includes(userId);
      
      // Find if user has reacted with any other emoji
      let previousEmoji: EmojiReaction | null = null;
      for (const [key, value] of Object.entries(reactions)) {
        if (key !== emoji && value.userIds.includes(userId)) {
          previousEmoji = key as EmojiReaction;
          break;
        }
      }
      
      // Start a batch of updates
      const updates: Record<string, any> = {};
      
      // If user already reacted with this emoji, remove the reaction
      if (hasReactedWithThisEmoji) {
        updates[`reactions.${emoji}.count`] = Math.max(0, reactions[emoji].count - 1);
        updates[`reactions.${emoji}.userIds`] = reactions[emoji].userIds.filter(id => id !== userId);
        console.log('✅ Removing reaction:', emoji, userId);
      } 
      // Otherwise, add the new reaction
      else {
        // If user had a previous reaction, remove it first
        if (previousEmoji) {
          updates[`reactions.${previousEmoji}.count`] = Math.max(0, reactions[previousEmoji].count - 1);
          updates[`reactions.${previousEmoji}.userIds`] = reactions[previousEmoji].userIds.filter(id => id !== userId);
          console.log('✅ Removing previous reaction:', previousEmoji, userId);
        }
        
        // Add the new reaction
        updates[`reactions.${emoji}.count`] = (reactions[emoji]?.count || 0) + 1;
        updates[`reactions.${emoji}.userIds`] = [...(reactions[emoji]?.userIds || []), userId];
        console.log('✅ Adding new reaction:', emoji, userId);
      }
      
      // Apply all updates at once
      await updateDoc(docRef, updates);
      console.log('✅ Reaction updated successfully');
      
    } catch (error) {
      console.error('❌ Error toggling reaction:', error);
      throw error;
    }
  }

  // Check if user has reacted with a specific emoji
  static hasUserReacted(announcement: AnnouncementData, emoji: EmojiReaction, userId: string): boolean {
    if (!announcement.reactions || !announcement.reactions[emoji]) {
      return false;
    }
    return announcement.reactions[emoji].userIds.includes(userId);
  }
  
  // Get the emoji that a user has reacted with (if any)
  static getUserReaction(announcement: AnnouncementData, userId: string): EmojiReaction | null {
    if (!announcement.reactions) return null;
    
    for (const [emoji, reaction] of Object.entries(announcement.reactions)) {
      if (reaction.userIds.includes(userId)) {
        return emoji as EmojiReaction;
      }
    }
    
    return null;
  }

  // Format timestamp for display
  static formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'Just now';
    
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }
}