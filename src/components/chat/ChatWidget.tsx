import React, { useState, useRef, useEffect } from 'react';
import FluidConversation from './FluidConversation';
import WineGlassButton from './WineGlassButton';
import { ChatPrompt } from './ChatPrompt';
import { useAuth } from '../../hooks/useAuth';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const chatPrompt = useRef(new ChatPrompt());

  // Initialize with welcome message when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: Date.now().toString(),
          text: "Hey there! I'm your AlmaLinks assistant and I know everything about our professional network and exclusive events. What would you like to know?",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  const addMessage = (text: string, isUser: boolean) => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add user message (but don't display it in Formless style)
    addMessage(text, true);
    setIsLoading(true);

    try {
      // Get AI response, passing the user's login status
      const response = await chatPrompt.current.getResponse(text, !!user);
      
      // Add AI response
      addMessage(response.text, false);
    } catch (error) {
      console.error('❌ Chat error:', error);
      addMessage("I'm having trouble responding right now. Please try again.", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset messages when closing
    setTimeout(() => {
      setMessages([]);
    }, 300);
  };

  return (
    <>
      {/* Floating Wine Glass Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <WineGlassButton onClick={() => setIsOpen(true)} isOpen={isOpen} />
        </div>
      )}

      {/* Full-screen Formless-style Interface */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <FluidConversation 
            messages={messages} 
            isLoading={isLoading} 
            onSendMessage={handleSendMessage}
            onClose={handleClose}
          />
        </div>
      )}
    </>
  );
};

export default ChatWidget;