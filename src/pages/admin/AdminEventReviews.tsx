import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  MessageSquare,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import BackButton from '../../components/ui/BackButton';
import ProfileAvatarPlaceholder from '../../components/profile/ProfileAvatarPlaceholder';
import { ReviewData, ReviewService } from '../../services/reviewService';
import { EventService, EventData } from '../../services/eventService';

type FilterTab = 'all' | 'new';

interface ReviewRow extends ReviewData {
  eventName: string;
  eventSlug: string;
}

function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={readOnly ? 'cursor-default' : 'focus:outline-none'}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            className={`h-4 w-4 ${
              star <= (hover || value) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

const AdminEventReviews: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [editingReview, setEditingReview] = useState<ReviewRow | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviewList, eventList] = await Promise.all([
        ReviewService.listAllReviewsForAdmin(),
        EventService.getAllEvents(),
      ]);
      setEvents(eventList);
      const rows: ReviewRow[] = reviewList.map((review) => {
        const event = eventList.find((e) => e.id === review.eventId);
        return {
          ...review,
          eventName: event?.name || 'Unknown event',
          eventSlug: event?.slug || review.eventId,
        };
      });
      setReviews(rows);
    } catch (e) {
      console.error(e);
      setError('Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const newCount = useMemo(
    () => reviews.filter((r) => ReviewService.isReviewNew(r.createdAt)).length,
    [reviews]
  );

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((review) => {
      if (filterTab === 'new' && !ReviewService.isReviewNew(review.createdAt)) return false;
      if (eventFilter && review.eventId !== eventFilter) return false;
      if (!term) return true;
      return (
        review.userName?.toLowerCase().includes(term) ||
        review.comment?.toLowerCase().includes(term) ||
        review.eventName?.toLowerCase().includes(term) ||
        ReviewService.formatPosition(review.position).toLowerCase().includes(term)
      );
    });
  }, [reviews, search, eventFilter, filterTab]);

  const openEdit = (review: ReviewRow) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment);
    setError(null);
  };

  const closeEdit = () => {
    setEditingReview(null);
    setEditRating(5);
    setEditComment('');
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;
    if (!editComment.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    if (editRating < 1) {
      setError('Please select a rating.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await ReviewService.adminUpdateReview(editingReview.id, editRating, editComment);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === editingReview.id
            ? { ...r, rating: editRating, comment: editComment.trim() }
            : r
        )
      );
      setSuccess('Review updated.');
      closeEdit();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update review.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (review: ReviewRow) => {
    if (
      !window.confirm(
        `Delete this review from ${review.userName}?\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(review.id);
    setError(null);
    try {
      await ReviewService.adminDeleteReview(review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      if (editingReview?.id === review.id) closeEdit();
      setSuccess('Review deleted.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete review.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <BackButton fallbackTo="/admin" />
      </div>

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-6 w-6 text-brand-blue" />
              <h1 className="text-2xl font-bold text-gray-900">Event reviews</h1>
            </div>
            <p className="text-sm text-gray-600">
              Moderate attendee feedback — view new reviews, edit content, or remove inappropriate posts.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total reviews</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
            {loading ? '—' : reviews.length}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">New (7 days)</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900 tabular-nums">
            {loading ? '—' : newCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Average rating</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
            {loading || avgRating === null ? '—' : `${avgRating} ★`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterTab === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('new')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterTab === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              New
              {newCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-white/20 px-1.5 text-xs">
                  {newCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviewer, comment, or event…"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              />
            </div>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="sm:w-56 px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading reviews…</div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Star className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No reviews match your filters.</p>
            <p className="text-sm text-gray-500 mt-1">
              {reviews.length === 0
                ? 'Reviews appear here after checked-in attendees submit feedback on completed events.'
                : 'Try clearing search or changing the event filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredReviews.map((review) => {
              const isNew = ReviewService.isReviewNew(review.createdAt);
              return (
                <article
                  key={review.id}
                  className={`p-4 sm:p-5 hover:bg-gray-50/80 transition-colors ${
                    isNew ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-11 w-11 rounded-full overflow-hidden border border-gray-100 shrink-0 bg-brand-dark">
                        {review.profilePictureUrl ? (
                          <img
                            src={review.profilePictureUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ProfileAvatarPlaceholder
                            name={review.userName}
                            className="h-full w-full"
                            textClassName="text-sm font-semibold"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{review.userName}</h3>
                          {isNew ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              New
                            </span>
                          ) : null}
                          <StarRating value={review.rating} readOnly />
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          {ReviewService.formatPosition(review.position)} ·{' '}
                          {ReviewService.formatReviewDate(review.createdAt)}
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {review.comment}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                            {review.eventName}
                          </span>
                          <Link
                            to={`/events/${review.eventSlug}`}
                            className="inline-flex items-center gap-1 text-brand-blue hover:text-brand-blue-hover font-medium"
                          >
                            View event
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Link
                            to={`/profile/${review.userId}`}
                            className="text-gray-500 hover:text-gray-800"
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:flex-col items-center lg:items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(review)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-white"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(review)}
                        disabled={deletingId === review.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === review.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editingReview ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close edit review"
            onClick={closeEdit}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit review</h2>
                <p className="text-sm text-gray-500">
                  {editingReview.userName} · {editingReview.eventName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <StarRating value={editRating} onChange={setEditRating} />
              </div>
              <div>
                <label htmlFor="edit-review-comment" className="block text-sm font-medium text-gray-700 mb-2">
                  Comment
                </label>
                <textarea
                  id="edit-review-comment"
                  rows={5}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminEventReviews;
