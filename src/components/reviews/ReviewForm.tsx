import React, { useState } from 'react';
import { Star, Send, AlertCircle } from 'lucide-react';
import { ReviewService } from '../../services/reviewService';
import { useAuth } from '../../hooks/useAuth';

interface ReviewFormProps {
  eventId: string;
  onReviewSubmitted: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ eventId, onReviewSubmitted }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRatingClick = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const handleRatingHover = (hoveredRating: number) => {
    setHoverRating(hoveredRating);
  };

  const handleRatingLeave = () => {
    setHoverRating(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to submit a review');
      return;
    }
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    if (!comment.trim()) {
      setError('Please enter a comment');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await ReviewService.createReview(
        eventId,
        user.uid,
        user.displayName || 'Anonymous',
        user.position || 'other',
        rating,
        comment,
        user.profileImage || null
      );
      
      // Reset form
      setRating(0);
      setComment('');
      
      // Notify parent component
      onReviewSubmitted();
    } catch (error: any) {
      console.error('❌ Error submitting review:', error);
      setError(error.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Share Your Experience</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Star Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Rating
          </label>
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingClick(star)}
                onMouseEnter={() => handleRatingHover(star)}
                onMouseLeave={handleRatingLeave}
                className="focus:outline-none"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={`h-8 w-8 ${
                    (hoverRating ? star <= hoverRating : star <= rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  } transition-colors duration-150`}
                />
              </button>
            ))}
          </div>
        </div>
        
        {/* Comment */}
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
            Your Comment
          </label>
          <textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts about this event..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 resize-none"
            disabled={isSubmitting}
          />
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || rating === 0 || !comment.trim()}
            className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-2 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Submit Review</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;