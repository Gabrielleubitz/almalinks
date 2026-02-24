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
} from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { AdminChatService, type AdminChatSummary } from '../../services/adminChatService';

export default function AdminChatManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<AdminChatSummary[]>([]);
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

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectedChat = addUserChatId ? chats.find((c) => c.id === addUserChatId) : null;

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">All Chats</h1>
          <button
            type="button"
            onClick={() => loadChats()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Refresh
          </button>
        </div>

        {actionError && (
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
          <div className="p-6 bg-white rounded-xl border border-gray-200 text-center text-gray-600">
            No chats yet.
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
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
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
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                      onClick={() => { setAddUserChatId(chat.id); setActionError(null); }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-dark text-white text-sm font-medium hover:bg-brand-mid"
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
                  onClick={() => { setAddUserChatId(null); setUserSearch(''); setActionError(null); }}
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
