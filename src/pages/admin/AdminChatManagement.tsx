import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Users,
  UserPlus,
  LogIn,
  ExternalLink,
  Search,
  X,
  AlertCircle,
  Loader2,
  Settings2,
  Trash2,
  Shield,
  ShieldOff,
  UserMinus,
  Save,
  Plus,
} from 'lucide-react';
import { collection, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { AdminChatService, type AdminChatDetails } from '../../services/adminChatService';
import { ChatService } from '../../services/chatService';
import CreateChatGroupFormPanel from '../../components/admin/CreateChatGroupFormPanel';

type EnrichedMember = {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  joinedAt: unknown;
};

export default function AdminChatManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<Awaited<ReturnType<typeof AdminChatService.getAllChats>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminInChatIds, setAdminInChatIds] = useState<Set<string>>(new Set());
  const [addUserChatId, setAddUserChatId] = useState<string | null>(null);
  const [memberIdsInSelectedChat, setMemberIdsInSelectedChat] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [userList, setUserList] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [joiningChatId, setJoiningChatId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Full-screen manage panel (edit group + members) */
  const [manageChatId, setManageChatId] = useState<string | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageMembers, setManageMembers] = useState<EnrichedMember[]>([]);
  const [manageMeta, setManageMeta] = useState<Partial<AdminChatDetails> | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    allowRequests: false,
    isPublic: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [memberActionKey, setMemberActionKey] = useState<string | null>(null);

  /** Create new group (WhatsApp-style) — same flow as /admin/chats/create */
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [createGroupKey, setCreateGroupKey] = useState(0);

  const loadChats = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const list = await AdminChatService.getAllChats();
      setChats(list);
      const memberSnap = await getDocs(
        query(
          collection(db, 'chat_members'),
          where('userId', '==', user.uid)
        )
      );
      const ids = new Set(memberSnap.docs.map((d) => d.data().chatId));
      setAdminInChatIds(ids);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const loadManagePanel = useCallback(async (chatId: string) => {
    setManageLoading(true);
    setActionError(null);
    try {
      const d = await AdminChatService.getChatDetails(chatId);
      const members: EnrichedMember[] = await Promise.all(
        d.members.map(async (m) => {
          const u = await getDoc(doc(db, 'users', m.userId));
          const ud = u.data();
          return {
            userId: m.userId,
            role: m.role,
            joinedAt: m.joinedAt,
            userName: (ud?.displayName || ud?.name || m.userName || m.userId) as string,
            userEmail: (ud?.email || m.userEmail || '') as string,
          };
        })
      );
      setManageMembers(members);
      setManageMeta(d);
      setEditForm({
        name: d.name,
        description: d.description || '',
        imageUrl: d.imageUrl || '',
        allowRequests: d.allowRequests ?? false,
        isPublic: d.isPublic ?? false,
      });
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : 'Failed to load chat');
      setManageChatId(null);
    } finally {
      setManageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (manageChatId && user?.uid) {
      loadManagePanel(manageChatId);
    } else {
      setManageMembers([]);
      setManageMeta(null);
    }
  }, [manageChatId, user?.uid, loadManagePanel]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('status', '==', 'approved'),
        limit(300)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        const firstLast = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
        const name =
          (data.displayName && String(data.displayName).trim()) ||
          firstLast ||
          (data.name && String(data.name).trim()) ||
          data.email ||
          d.id;
        return { id: d.id, name: String(name), email: String(data.email || '') };
      });
      setUserList(list);
    } catch (e) {
      console.error(e);
      setUserList([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (addUserChatId) {
      loadUsers();
      AdminChatService.getChatDetails(addUserChatId)
        .then((details) => setMemberIdsInSelectedChat(new Set(details.members.map((m) => m.userId))))
        .catch(() => setMemberIdsInSelectedChat(new Set()));
    } else {
      setMemberIdsInSelectedChat(new Set());
    }
  }, [addUserChatId, loadUsers]);

  const filteredUsers = userSearch.trim()
    ? userList.filter(
        (u) =>
          !memberIdsInSelectedChat.has(u.id) &&
          (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
            u.email.toLowerCase().includes(userSearch.toLowerCase()))
      )
    : userList.filter((u) => !memberIdsInSelectedChat.has(u.id)).slice(0, 50);

  const handleAddUser = async (chatId: string, targetUserId: string) => {
    if (!user?.uid) return;
    setActionError(null);
    setAddingUserId(targetUserId);
    try {
      await AdminChatService.addMemberToChat(chatId, targetUserId, user.uid);
      setAddUserChatId(null);
      setUserSearch('');
      await loadChats();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to add user');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleJoin = async (chatId: string) => {
    if (!user?.uid) return;
    setActionError(null);
    setJoiningChatId(chatId);
    try {
      await AdminChatService.joinChatAsAppAdmin(chatId, user.uid);
      setAdminInChatIds((prev) => new Set(prev).add(chatId));
      await loadChats();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to join chat');
    } finally {
      setJoiningChatId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!user?.uid || !manageChatId) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await ChatService.updateChat(
        manageChatId,
        {
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          imageUrl: editForm.imageUrl.trim(),
          allowRequests: editForm.allowRequests,
          isPublic: editForm.isPublic,
        },
        user.uid
      );
      await loadChats();
      await loadManagePanel(manageChatId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!user?.uid || !manageChatId || !manageMeta) return;
    const name = manageMeta.name || 'this chat';
    if (
      !window.confirm(
        `Delete group “${name}” permanently?\n\nAll messages and memberships will be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingChat(true);
    setActionError(null);
    try {
      await ChatService.deleteChat(manageChatId, user.uid);
      setManageChatId(null);
      await loadChats();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete chat');
    } finally {
      setDeletingChat(false);
    }
  };

  const runMemberAction = async (key: string, fn: () => Promise<void>) => {
    setMemberActionKey(key);
    setActionError(null);
    try {
      await fn();
      if (manageChatId) await loadManagePanel(manageChatId);
      await loadChats();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setMemberActionKey(null);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectedChat = addUserChatId ? chats.find((c) => c.id === addUserChatId) : null;
  const adminCount = manageMembers.filter((m) => m.role === 'admin').length;

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create new groups or manage existing ones (like WhatsApp: name, photo, members, discoverability).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateGroupKey((k) => k + 1);
                setShowCreateGroup(true);
                setActionError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-dark text-white text-sm font-medium hover:bg-brand-mid shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New group
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/chats/create')}
              className="text-sm text-gray-600 hover:text-gray-900 px-2 py-2"
            >
              Full page
            </button>
            <button
              type="button"
              onClick={() => loadChats()}
              className="text-sm text-gray-600 hover:text-gray-900 px-2 py-2"
            >
              Refresh
            </button>
          </div>
        </div>

        {actionError && !manageChatId && !showCreateGroup && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {actionError}
            <button type="button" onClick={() => setActionError(null)} className="ml-auto p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-6 bg-white rounded-xl border border-gray-200 text-center text-gray-600">
            {error}
          </div>
        ) : chats.length === 0 ? (
          <div className="p-8 bg-white rounded-xl border border-gray-200 text-center">
            <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium mb-1">No groups yet</p>
            <p className="text-sm text-gray-500 mb-4">Create a group to get started — add admins, members, and a photo.</p>
            <button
              type="button"
              onClick={() => {
                setCreateGroupKey((k) => k + 1);
                setShowCreateGroup(true);
                setActionError(null);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-dark text-white text-sm font-medium hover:bg-brand-mid"
            >
              <Plus className="h-4 w-4" />
              Create new group
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => {
              const isInChat = adminInChatIds.has(chat.id);
              return (
                <div
                  key={chat.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-brand-dark flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {chat.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{chat.name}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3" />
                          {chat.memberCount} members
                        </span>
                        <span>{chat.messageCount} messages</span>
                        {chat.lastActivity && (
                          <span>Last activity {formatDate(chat.lastActivity)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setManageChatId(chat.id);
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-dark text-white text-sm font-medium hover:bg-brand-mid"
                    >
                      <Settings2 className="h-4 w-4" />
                      Manage group
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/chats/${chat.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddUserChatId(chat.id);
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add user
                    </button>
                    {!isInChat && (
                      <button
                        type="button"
                        onClick={() => handleJoin(chat.id)}
                        disabled={joiningChatId === chat.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 disabled:opacity-50"
                      >
                        {joiningChatId === chat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogIn className="h-4 w-4" />
                        )}
                        Join
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create new group (same flow as full-page create) */}
        {showCreateGroup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto my-4">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
                <h2 className="text-lg font-semibold text-gray-900">Create new group</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <CreateChatGroupFormPanel
                  key={createGroupKey}
                  variant="modal"
                  onCancel={() => setShowCreateGroup(false)}
                  onSuccess={(chatId) => {
                    setShowCreateGroup(false);
                    loadChats();
                    navigate(`/chats/${chatId}`);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Manage group panel */}
        {manageChatId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col my-8">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-brand-dark" />
                  Manage group
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setManageChatId(null);
                    setActionError(null);
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {actionError && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {actionError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-8">
                {manageLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    <section>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Group info (like WhatsApp)
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="text-xs text-gray-500">Name</span>
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs text-gray-500">Description</span>
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            rows={3}
                            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs text-gray-500">Group image URL (optional)</span>
                          <input
                            value={editForm.imageUrl}
                            onChange={(e) => setEditForm((f) => ({ ...f, imageUrl: e.target.value }))}
                            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://..."
                          />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.allowRequests}
                            onChange={(e) => setEditForm((f) => ({ ...f, allowRequests: e.target.checked }))}
                          />
                          <span className="text-sm text-gray-700">Allow join requests</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.isPublic}
                            onChange={(e) => setEditForm((f) => ({ ...f, isPublic: e.target.checked }))}
                          />
                          <span className="text-sm text-gray-700">Discoverable (public)</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit()}
                        disabled={savingEdit || !editForm.name.trim()}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-dark text-white text-sm font-medium hover:bg-brand-mid disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save changes
                      </button>
                    </section>

                    <section>
                      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Members ({manageMembers.length})
                      </h3>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Member</th>
                              <th className="text-left px-3 py-2 font-medium">Role</th>
                              <th className="text-right px-3 py-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manageMembers.map((m) => {
                              const key = `${m.userId}-${m.role}`;
                              const busy = memberActionKey === key;
                              return (
                                <tr key={m.userId} className="border-t border-gray-100">
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-gray-900 truncate">{m.userName}</div>
                                    <div className="text-xs text-gray-500 truncate">{m.userEmail || m.userId}</div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={
                                        m.role === 'admin'
                                          ? 'text-amber-700 font-medium'
                                          : 'text-gray-600'
                                      }
                                    >
                                      {m.role === 'admin' ? 'Admin' : 'Member'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="flex flex-wrap justify-end gap-1">
                                      {user?.uid && m.userId !== user.uid && (
                                        <>
                                          {m.role === 'member' && (
                                            <button
                                              type="button"
                                              disabled={busy}
                                              onClick={() =>
                                                runMemberAction(key, () =>
                                                  ChatService.promoteMemberToAdmin(
                                                    manageChatId!,
                                                    m.userId,
                                                    user.uid
                                                  )
                                                )
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-200 text-amber-800 text-xs hover:bg-amber-50 disabled:opacity-50"
                                              title="Make admin"
                                            >
                                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                                              Promote
                                            </button>
                                          )}
                                          {m.role === 'admin' && adminCount > 1 && (
                                            <button
                                              type="button"
                                              disabled={busy}
                                              onClick={() =>
                                                runMemberAction(key, () =>
                                                  ChatService.demoteAdminToMember(
                                                    manageChatId!,
                                                    m.userId,
                                                    user.uid
                                                  )
                                                )
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-gray-700 text-xs hover:bg-gray-50 disabled:opacity-50"
                                              title="Remove admin"
                                            >
                                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
                                              Demote
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                              if (
                                                !window.confirm(
                                                  `Remove ${m.userName} from this group?`
                                                )
                                              )
                                                return;
                                              void runMemberAction(key, () =>
                                                ChatService.removeMember(
                                                  manageChatId!,
                                                  m.userId,
                                                  user.uid
                                                )
                                              );
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-red-700 text-xs hover:bg-red-50 disabled:opacity-50"
                                          >
                                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
                                            Remove
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        As an app admin you can manage any group without joining. Chat admins can also manage their own groups in the chat screen.
                      </p>
                    </section>

                    <section className="border-t border-red-100 pt-6">
                      <h3 className="text-sm font-semibold text-red-800 mb-2">Danger zone</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Delete this group for everyone. All messages are removed.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeleteChat()}
                        disabled={deletingChat}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-300 text-red-700 bg-red-50 hover:bg-red-100 text-sm font-medium disabled:opacity-50"
                      >
                        {deletingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete group
                      </button>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add user modal */}
        {addUserChatId && selectedChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Add user to {selectedChat.name}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setAddUserChatId(null);
                    setUserSearch('');
                    setActionError(null);
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {loadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {filteredUsers.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => handleAddUser(selectedChat.id, u.id)}
                          disabled={addingUserId === u.id}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center justify-between disabled:opacity-50"
                        >
                          <span className="truncate">
                            <span className="font-medium text-gray-900">{u.name}</span>
                            {u.email && <span className="text-gray-500 text-sm ml-2">{u.email}</span>}
                          </span>
                          {addingUserId === u.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />
                          )}
                        </button>
                      </li>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="text-sm text-gray-500 py-4 text-center">No users found</p>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
