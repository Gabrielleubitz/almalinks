import ProfileAvatarPlaceholder from '../profile/ProfileAvatarPlaceholder';
import React from 'react';
import { Star, User } from 'lucide-react';
import { ReviewData, ReviewService } from '../../services/reviewService';

interface ReviewListProps {
  reviews: ReviewData[];
  loading: boolean;
}

const ReviewList: React.FC<ReviewListProps> = ({ reviews, loading }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading reviews...</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-2xl">
        <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Yet</h3>
        <p className="text-gray-600">
          Be the first to share your experience at this event!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div 
          key={review.id}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-start space-x-4">
            {/* User Avatar */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full overflow-hidden">
                {review.profilePictureUrl ? (
                  <img 
                    src={review.profilePictureUrl} 
                    alt={review.userName} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                    }}
                  />
                ) : (
                  <ProfileAvatarPlaceholder
                    name={review.userName}
                    className="w-full h-full"
                    textClassName="font-bold"
                  />
                )}
              </div>
            </div>
            
            {/* Review Content */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{review.userName}</h4>
                  <p className="text-sm text-gray-600">{ReviewService.formatPosition(review.position)}</p>
                </div>
                
                {/* Star Rating */}
                <div className="flex mt-1 sm:mt-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= review.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Review Comment */}
              <p className="text-gray-700 mt-2">{review.comment}</p>
              
              {/* Review Date */}
              <div className="text-xs text-gray-500 mt-2">
                {review.createdAt?.toDate 
                  ? new Date(review.createdAt.toDate()).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  : 'Recent'
                }
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewList;