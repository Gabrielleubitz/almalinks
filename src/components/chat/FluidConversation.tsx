import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { Message } from './ChatWidget';
import TypewriterText from './TypewriterText';
import logoSvg from '../../assets/alma-links-logo.svg';

interface FluidConversationProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClose: () => void;
}

const FluidConversation: React.FC<FluidConversationProps> = ({ 
  messages, 
  isLoading, 
  onSendMessage, 
  onClose 
}) => {
  const [inputText, setInputText] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [typewriterKey, setTypewriterKey] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Wine & tech themed loading messages
  const loadingMessages = [
    "Swirling my wine glass... I mean, processing your request 🍷",
    "Debugging this conversation with some premium wine logic...",
    "Loading knowledge... Please wait while I aerate my thoughts",
    "Compiling insights from our Alma Links database...",
    "Fermenting the perfect response... This might take a moment",
    "Running algorithms on premium grape-sourced intelligence...",
    "Optimizing my neural networks with a splash of wine wisdom...",
    "Processing... My servers run better with a glass of red nearby",
    "Calculating the perfect blend of tech and wine knowledge...",
    "Brewing up the answer in my silicon wine cellar...",
    "Loading... Even AI needs time to properly taste ideas",
    "Accessing my wine-enhanced knowledge base... Stand by",
  ];

  // Cycle through loading messages
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 2000); // Change message every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isLoading, loadingMessages.length]);

  // Set random loading message index when loading starts
  useEffect(() => {
    if (isLoading) {
      setLoadingMessageIndex(Math.floor(Math.random() * loadingMessages.length));
    }
  }, [isLoading, loadingMessages.length]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 1 && !messages[0].isUser) {
      setCurrentMessage(messages[0].text);
      setTypewriterKey(prev => prev + 1);
    }
  }, []);

  // Handle new assistant messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && !lastMessage.isUser && lastMessage.text !== currentMessage) {
      setCurrentMessage(lastMessage.text);
      setTypewriterKey(prev => prev + 1);
      setShowInput(true);
    }
  }, [messages]);

  // Auto-focus input after typewriter completes
  const handleTypewriterComplete = () => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading && !isTransitioning) {
      const userMessage = inputText.trim();
      
      // Hide input and start transition
      setShowInput(false);
      setIsTransitioning(true);
      
      // Clear input
      setInputText('');
      
      // Fade out current message
      setTimeout(() => {
        setCurrentMessage('');
        onSendMessage(userMessage);
        setIsTransitioning(false);
      }, 400);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full h-full bg-white relative overflow-hidden">
      {/* Alma Links Logo - Top Left */}
      <div className="absolute top-6 left-6 z-10">
        <img 
          src={logoSvg}
          alt="Alma Links Logo" 
          className="h-8 w-auto opacity-60 hover:opacity-100 transition-opacity duration-200"
        />
      </div>

      {/* Close button - minimal and elegant */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-10 text-gray-400 hover:text-gray-600 transition-colors duration-200"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Main content area - centered like Formless */}
      <div className="flex flex-col items-center justify-center min-h-full px-8 py-16">
        <div className="w-full max-w-3xl">
          
          {/* Message display area */}
          <div className="mb-16">
            {isLoading ? (
              // Loading state with rotating wine/tech humor
              <div className="text-gray-900 text-2xl md:text-3xl leading-relaxed font-light tracking-wide">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                  <span className="text-gray-600 text-lg md:text-xl font-light animate-pulse">
                    {loadingMessages[loadingMessageIndex]}
                  </span>
                </div>
              </div>
            ) : currentMessage ? (
              // Current message with typewriter effect
              <div className={`transition-all duration-400 ${
                isTransitioning ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'
              }`}>
                <TypewriterText
                  key={typewriterKey}
                  text={currentMessage}
                  speed={35}
                  onComplete={handleTypewriterComplete}
                  className="text-gray-900 text-2xl md:text-3xl leading-relaxed font-light tracking-wide"
                />
              </div>
            ) : (
              // Empty state
              <div className="text-gray-900 text-2xl md:text-3xl leading-relaxed font-light tracking-wide">
                <span className="animate-pulse text-red-500 font-mono">|</span>
              </div>
            )}
          </div>

          {/* Input area - only show when ready */}
          {showInput && !isLoading && (
            <div className={`transition-all duration-300 ${
              isTransitioning ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'
            }`}>
              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type your response..."
                  className="w-full text-xl md:text-2xl font-light bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 py-4 pr-16"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isTransitioning}
                  style={{ 
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                />
                
                {/* Subtle underline */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200"></div>
                
                {/* Send button - minimal */}
                <button 
                  type="submit"
                  disabled={!inputText.trim() || isTransitioning}
                  className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 disabled:text-gray-300 transition-colors duration-200"
                >
                  <Send className="h-6 w-6" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FluidConversation;