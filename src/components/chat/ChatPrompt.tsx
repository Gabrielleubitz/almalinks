import React from 'react';

export interface ChatResponse {
  text: string;
  shouldSpeak: boolean;
}

export class ChatPrompt {
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  async getResponse(userMessage: string, isUserLoggedIn: boolean): Promise<ChatResponse> {
    console.log('🤖 Processing user message via enhanced API:', userMessage, 'User logged in:', isUserLoggedIn);
    
    try {
      // Call the new enhanced chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          isUserLoggedIn: isUserLoggedIn,
          conversationHistory: this.conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      // Update conversation history
      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: data.response });

      // Keep conversation history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      console.log('✅ Enhanced chat response received successfully');

      return {
        text: data.response,
        shouldSpeak: false
      };

    } catch (error) {
      console.error('❌ Error calling enhanced chat API:', error);
      
      // Fallback response
      const fallbackResponse = "I'm having trouble accessing my knowledge base right now. Please try again in a moment, or contact us at info@almalinks.com for immediate assistance.";
      
      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: fallbackResponse });

      return {
        text: fallbackResponse,
        shouldSpeak: false
      };
    }
  }

}