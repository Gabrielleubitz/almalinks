import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/ui/BackButton';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import CreateChatGroupFormPanel from '../../components/admin/CreateChatGroupFormPanel';

/**
 * Full-page admin route: create a new group chat (same flow as Admin → Chats → Create).
 */
const CreateChatGroup: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-full overflow-x-hidden w-full max-w-full">
        <div className="py-16 flex items-center justify-center">
          <LoadingSpinner size="lg" color="border-blue-600" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/unauthorized');
    return null;
  }

  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 overflow-x-hidden w-full max-w-full box-border">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
              <BackButton fallbackTo="/admin/chats" iconOnly className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" iconClassName="h-5 w-5" />
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create chat group</h1>
                <p className="text-sm sm:text-base text-gray-600">
                  New group with admins, members, and privacy settings (same as Admin → Chats).
                </p>
              </div>
            </div>
          </div>

          <CreateChatGroupFormPanel variant="page" />
        </div>
      </div>
    </div>
  );
};

export default CreateChatGroup;
