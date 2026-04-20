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
    <section id="event-reviews" className="py-12 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Event <span className="gradient-text">Reviews</span>
          </h2>
          <p className="text-lg text-gray-600">
            See what attendees thought about this event
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-center">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Review Form - Only show for completed events if user attended and hasn't reviewed yet */}
          {isCompleted && userEligible && !userHasReviewed && (
            <ReviewForm eventId={eventId} onReviewSubmitted={handleReviewSubmitted} />
          )}

          {/* Reviews List */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <MessageSquare className="h-6 w-6 text-red-700" />
              <h3 className="text-xl font-bold text-gray-900">Attendee Reviews</h3>
            </div>
            
            <ReviewList reviews={reviews} loading={loading} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewSection;