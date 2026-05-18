import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { ReviewService, ReviewData } from '../../services/reviewService';
import { useAuth } from '../../hooks/useAuth';
import ReviewForm from './ReviewForm';
import ReviewList from './ReviewList';

interface ReviewSectionProps {
  eventId: string;
  isCompleted: boolean;
  /** User must be checked in (not only registered) to leave a review. */
  userCheckedIn: boolean;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ eventId, isCompleted, userCheckedIn }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userEligible, setUserEligible] = useState<boolean>(false);
  const [userHasReviewed, setUserHasReviewed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, [eventId, user]);

  useEffect(() => {
    setUserEligible(!!user && userCheckedIn);
  }, [user, userCheckedIn]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const eventReviews = await ReviewService.getEventReviews(eventId);
      setReviews(eventReviews);
      
      // Check if current user has already reviewed
      if (user) {
        const userReview = await ReviewService.getUserReviewForEvent(user.uid, eventId);
        setUserHasReviewed(!!userReview);
      }
    } catch (error) {
      console.error('❌ Error loading reviews:', error);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmitted = () => {
    // Reload reviews after submission
    loadReviews();
    setUserHasReviewed(true);
  };

  return (
    <section id="event-reviews" className="py-6 sm:py-8 bg-gray-50 border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Event reviews</h2>
          <p className="text-sm text-gray-600 mt-1">Feedback from attendees</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-center">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Review Form - Only show for completed events if user attended and hasn't reviewed yet */}
          {isCompleted && userEligible && !userHasReviewed && (
            <ReviewForm eventId={eventId} onReviewSubmitted={handleReviewSubmitted} />
          )}

          {/* Reviews List */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <MessageSquare className="h-5 w-5 text-red-700" />
              <h3 className="text-base font-bold text-gray-900">Reviews</h3>
            </div>
            
            <ReviewList reviews={reviews} loading={loading} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;