import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users, Search, Shield, AlertCircle, ImagePlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useActivityTracking } from '../../hooks/useActivityTracking';
import { UserService } from '../../services/userService';
import { uploadImageToLibrary } from '../../services/imageUploadService';
import type { CreateChatGroupForm as CreateChatGroupFormData } from '../../types/chat';
import { UserCard } from '../../types/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import SaveButtonWithFeedback from '../../components/ui/SaveButtonWithFeedback';
import { auth } from '../../firebase/config';
import CoverPhotoCropModal, { type CoverCrop } from '../../components/profile/CoverPhotoCropModal';
import CropImage from '../../components/profile/CropImage';

export interface CreateChatGroupFormPanelProps {
  /** `page` = full width layout; `modal` = embedded in admin modal (scrollable) */
  variant?: 'page' | 'modal';
  /** Called after successful create; if omitted, navigates to the new chat */
  onSuccess?: (chatId: string) => void;
  /** Close button / cancel (e.g. modal) */
  onCancel?: () => void;
}

/**
 * WhatsApp-style group creation: name, description, image, join/discovery settings, pick admins & members.
 * Used by Create Chat Group page and Admin → Chats.
 */
const CreateChatGroupFormPanel: React.FC<CreateChatGroupFormPanelProps> = ({
  variant = 'page',
  onSuccess,
  onCancel,
}) => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { logActivity } = useActivityTracking();

  const [formData, setFormData] = useState<CreateChatGroupFormData>({
    name: '',
    description: '',
    imageUrl: '',
    imageCrop: null,
    allowRequests: false,
    isPublic: false,
    initialAdmins: [],
    seedMembers: [],
  });

  const [users, setUsers] = useState<UserCard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showImageCropModal, setShowImageCropModal] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (user?.uid) {
      setFormData((prev) => ({
        ...prev,
        initialAdmins: prev.initialAdmins.length ? prev.initialAdmins : [user.uid],
      }));
    }
    loadUsers();
  }, [user?.uid, user?.role, authLoading]);

  const loadUsers = async () => {
    if (!user?.uid) {
      setUsersLoading(false);
      return;
    }
    try {
      setUsersLoading(true);
      setUsersLoadError(null);
      const allUsers = await UserService.getAllMembersForDirectory(user.uid, user.role);
      setUsers(allUsers);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      let errorMessage = 'Failed to load users';
      if (e.message?.includes('Permission denied') || e.code === 'permission-denied') {
        errorMessage =
          'Permission denied loading users. Ensure you are an admin and Firestore rules allow it.';
      } else if (e.message?.includes('index') || e.code === 'failed-precondition') {
        errorMessage = 'Missing Firestore index — check the browser console for a creation link.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      setUsersLoadError(errorMessage);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleUserSelection = (targetUserId: string, role: 'admin' | 'member') => {
    setFormData((prev) => {
      const currentAdmins = prev.initialAdmins;
      const currentMembers = prev.seedMembers;
      if (role === 'admin') {
        if (currentAdmins.includes(targetUserId)) {
          return { ...prev, initialAdmins: currentAdmins.filter((id) => id !== targetUserId) };
        }
        return {
          ...prev,
          initialAdmins: [...currentAdmins, targetUserId],
          seedMembers: currentMembers.filter((id) => id !== targetUserId),
        };
      }
      if (currentMembers.includes(targetUserId)) {
        return { ...prev, seedMembers: currentMembers.filter((id) => id !== targetUserId) };
      }
      const newAdmins =
        targetUserId === user?.uid ? currentAdmins : currentAdmins.filter((id) => id !== targetUserId);
      return {
        ...prev,
        initialAdmins: newAdmins,
        seedMembers: [...currentMembers, targetUserId],
      };
    });
  };

  const getUserRole = (targetUserId: string): 'admin' | 'member' | 'none' => {
    if (formData.initialAdmins.includes(targetUserId)) return 'admin';
    if (formData.seedMembers.includes(targetUserId)) return 'member';
    return 'none';
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q) ||
      (u.title || '').toLowerCase().includes(q) ||
      (u.company || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || loading) return;
    setFormError(null);
    setSuccess(null);
    setDebugInfo(null);

    if (!formData.name.trim()) {
      setFormError('Chat name is required');
      return;
    }
    if (formData.name.length > 100) {
      setFormError('Chat name must be 100 characters or less');
      return;
    }
    if (formData.description.length > 500) {
      setFormError('Description must be 500 characters or less');
      return;
    }
    if (formData.initialAdmins.length === 0) {
      setFormError('At least one admin is required');
      return;
    }

    try {
      setLoading(true);
      const requestData = { ...formData, createdBy: user.uid };
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated. Please try logging out and back in.');
      }
      const idToken = await currentUser.getIdToken(true);
      const response = await fetch('/api/admin/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const raw = await response.text();
        let errorData: { message?: string; error?: string; details?: string } = {};
        try {
          errorData = raw ? (JSON.parse(raw) as typeof errorData) : {};
        } catch {
          errorData = { error: raw?.slice(0, 200) || 'Request failed' };
        }
        const errorMessage =
          errorData.message ||
          errorData.error ||
          `Failed to create chat group (${response.status})`;
        const details = errorData.details;
        setDebugInfo(
          `Status: ${response.status} | User: ${user.uid}${details ? ` | ${details}` : ''}`
        );
        throw new Error(errorMessage);
      }

      const result = (await response.json()) as { chatId: string };
      setSavedAt(Date.now());
      setSuccess('Group created successfully.');

      logActivity('chat_create', `Created chat group: ${formData.name}`, {
        chatId: result.chatId,
        isPublic: formData.isPublic,
        allowRequests: formData.allowRequests,
        initialAdminsCount: formData.initialAdmins.length,
        seedMembersCount: formData.seedMembers.length,
      });

      if (onSuccess) {
        onSuccess(result.chatId);
      } else {
        setTimeout(() => navigate(`/chats/${result.chatId}`), 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create chat group.';
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <LoadingSpinner size="lg" color="border-blue-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-600 text-sm">You must be an admin to create groups.</div>
    );
  }

  const gridClass =
    variant === 'modal'
      ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[min(85vh,900px)] overflow-y-auto pr-1'
      : 'grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8';

  const labelForUid = (uid: string) => {
    const u = users.find((x) => x.uid === uid);
    if (!u) return uid.length > 10 ? `${uid.slice(0, 8)}…` : uid;
    const name =
      (u.displayName && u.displayName.trim()) ||
      `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
      (u.name && String(u.name).trim()) ||
      (u.email && u.email.trim()) ||
      uid;
    return name;
  };

  return (
    <div className={variant === 'modal' ? 'w-full' : ''}>
      <div className={gridClass}>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-brand-dark" />
            New group
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="ccg-name" className="block text-sm font-medium text-gray-700 mb-2">
                Group name *
              </label>
              <input
                id="ccg-name"
                name="name"
                type="text"
                required
                maxLength={100}
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                placeholder="e.g. Alumni — NYC"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.name.length}/100</p>
            </div>

            <div>
              <label htmlFor="ccg-desc" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="ccg-desc"
                name="description"
                rows={3}
                maxLength={500}
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl resize-none text-sm"
                placeholder="What is this group for?"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500</p>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Group image</span>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || !file.type.startsWith('image/')) return;
                  setFormError(null);
                  setPendingImageFile(file);
                  setCropPreviewUrl(URL.createObjectURL(file));
                  setShowImageCropModal(true);
                  e.target.value = '';
                  if (imageInputRef.current) imageInputRef.current.value = '';
                }}
              />
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  name="imageUrl"
                  type="url"
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  className="flex-1 min-w-[200px] px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                  placeholder="Image URL or upload"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={loading || imageUploading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {imageUploading ? (
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  Upload
                </button>
              </div>
              {formData.imageUrl && (
                <div className="mt-2 w-12 h-12 rounded-full overflow-hidden border border-gray-200">
                  <CropImage
                    src={formData.imageUrl}
                    crop={formData.imageCrop ?? null}
                    alt="Preview"
                    mode="block"
                    className="w-full h-full rounded-full"
                  />
                </div>
              )}
            </div>

            {showImageCropModal && cropPreviewUrl && (
              <CoverPhotoCropModal
                imageUrl={cropPreviewUrl}
                aspectRatio="1/1"
                title="Position group image"
                onConfirm={async (_url, crop: CoverCrop) => {
                  if (!pendingImageFile) return;
                  setImageUploading(true);
                  setFormError(null);
                  try {
                    const url = await uploadImageToLibrary('chat-groups', pendingImageFile);
                    setFormData((prev) => ({ ...prev, imageUrl: url, imageCrop: crop }));
                  } catch (err: unknown) {
                    setFormError(err instanceof Error ? err.message : 'Image upload failed');
                  } finally {
                    setImageUploading(false);
                    URL.revokeObjectURL(cropPreviewUrl);
                    setCropPreviewUrl(null);
                    setPendingImageFile(null);
                    setShowImageCropModal(false);
                  }
                }}
                onCancel={() => {
                  if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
                  setCropPreviewUrl(null);
                  setPendingImageFile(null);
                  setShowImageCropModal(false);
                }}
              />
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="ccg-allow" className="text-sm font-medium text-gray-700">
                    Allow join requests
                  </label>
                  <p className="text-xs text-gray-500">Members can ask to join (like invite links)</p>
                </div>
                <input
                  id="ccg-allow"
                  name="allowRequests"
                  type="checkbox"
                  checked={formData.allowRequests}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label htmlFor="ccg-public" className="text-sm font-medium text-gray-700">
                    Discoverable
                  </label>
                  <p className="text-xs text-gray-500">Show in Discover chats</p>
                </div>
                <input
                  id="ccg-public"
                  name="isPublic"
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-2">
              <div>
                <span className="font-medium text-gray-900">Summary:</span>{' '}
                {formData.initialAdmins.length} admin(s), {formData.seedMembers.length} member(s)
              </div>
              {formData.initialAdmins.length > 0 && (
                <div>
                  <span className="font-medium text-gray-800">Admins:</span>{' '}
                  <span className="text-gray-700">
                    {formData.initialAdmins.map(labelForUid).join(' · ')}
                  </span>
                </div>
              )}
              {formData.seedMembers.length > 0 && (
                <div>
                  <span className="font-medium text-gray-800">Members:</span>{' '}
                  <span className="text-gray-700">
                    {formData.seedMembers.map(labelForUid).join(' · ')}
                  </span>
                </div>
              )}
            </div>

            {debugInfo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs font-mono text-yellow-900">
                {debugInfo}
              </div>
            )}
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">{success}</div>
            )}

            <div className="flex flex-wrap gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <SaveButtonWithFeedback
                type="submit"
                saving={loading}
                savedAt={savedAt}
                disabled={!formData.name.trim() || formData.initialAdmins.length === 0}
                label="Create group"
                savingLabel="Creating…"
                successLabel="Created"
                className="flex-1 min-w-[140px] flex items-center justify-center px-4 py-2.5 bg-brand-dark text-white rounded-xl hover:bg-brand-mid disabled:opacity-50 text-sm font-medium"
                successClassName="flex-1 min-w-[140px] flex items-center justify-center px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium"
              />
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              Add people
            </h2>
            <span className="text-xs text-gray-500">
              {formData.initialAdmins.length + formData.seedMembers.length} selected
              {users.length > 0 ? ` · ${users.length} in directory` : ''}
            </span>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, company…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm"
            />
          </div>

          {usersLoadError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>{usersLoadError}</p>
                <button type="button" onClick={loadUsers} className="mt-2 text-sm font-medium underline">
                  Retry
                </button>
              </div>
            </div>
          )}

          <div
            className={`space-y-2 overflow-y-auto ${variant === 'modal' ? 'max-h-[320px] xl:max-h-[min(70vh,560px)]' : 'max-h-96'}`}
          >
            {usersLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner size="md" color="border-blue-600" />
                <p className="text-sm text-gray-500 mt-3">Loading members…</p>
              </div>
            ) : usersLoadError ? null : filteredUsers.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">No users match your search.</p>
            ) : (
              filteredUsers.map((u) => {
                const role = getUserRole(u.uid);
                const isCurrentUser = u.uid === user?.uid;
                return (
                  <div
                    key={u.uid}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                        {(u.displayName || u.firstName || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {u.displayName || u.firstName || u.email || 'User'}
                          {isCurrentUser && ' (you)'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.title && u.company
                            ? `${u.title} · ${u.company}`
                            : u.title || u.company || u.email || ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {role === 'admin' && (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </span>
                      )}
                      {role === 'member' && (
                        <span className="hidden sm:inline text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          Member
                        </span>
                      )}
                      <div className="grid grid-cols-2 gap-1 flex-1 sm:flex-initial sm:flex">
                        <button
                          type="button"
                          onClick={() => handleUserSelection(u.uid, 'admin')}
                          disabled={isCurrentUser && formData.initialAdmins.length === 1}
                          className={`px-2 py-2 text-xs rounded-lg font-medium ${
                            role === 'admin'
                              ? 'bg-brand-dark text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-purple-100'
                          } ${isCurrentUser && formData.initialAdmins.length === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Admin
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUserSelection(u.uid, 'member')}
                          className={`px-2 py-2 text-xs rounded-lg font-medium ${
                            role === 'member'
                              ? 'bg-brand-dark text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-blue-50'
                          }`}
                        >
                          Member
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChatGroupFormPanel;
