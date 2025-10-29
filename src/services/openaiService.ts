// Browser-compatible OpenAI API client without the openai package
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Debug API key (only shows first/last few characters for security)
const debugApiKey = () => {
  if (!OPENAI_API_KEY) {
    console.error('❌ VITE_OPENAI_API_KEY is undefined');
    return 'undefined';
  }
  const key = OPENAI_API_KEY.toString();
  if (key.length < 10) {
    console.error('❌ API key seems too short:', key.length, 'characters');
    return `short-${key.length}chars`;
  }
  return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
};

interface ImageGenerationOptions {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

interface BusinessInfo {
  businessName: string;
  productService: string;
  targetCustomer: string;
  industry: string;
  brandTone: string;
}

interface AdContent {
  headline: string;
  body: string;
  platform: 'facebook' | 'google';
}

export class OpenAIService {
  /**
   * Generate an image using DALL-E 3 (most powerful version) via direct API call
   */
  static async generateImage(options: ImageGenerationOptions): Promise<string> {
    console.log('🔍 Debug API Key:', debugApiKey());
    console.log('🔍 Environment check:', {
      hasVitePrefix: !!import.meta.env.VITE_OPENAI_API_KEY,
      keyLength: OPENAI_API_KEY?.length || 0,
      keyStart: OPENAI_API_KEY?.substring(0, 8) || 'none'
    });
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment variables.');
    }

    try {
      console.log('🎨 Generating image with DALL-E 3:', options.prompt);

      const response = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3', // Most powerful version
          prompt: options.prompt,
          n: 1,
          size: options.size || '1024x1024',
          quality: options.quality || 'hd', // HD quality for best results
          style: options.style || 'vivid', // Vivid for more dramatic, eye-catching images
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific OpenAI errors
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY environment variable.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 400) {
          const errorMessage = errorData.error?.message || 'Invalid prompt';
          throw new Error(`Invalid request: ${errorMessage}. Please modify your image description and try again.`);
        }
        
        throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      console.log('✅ Image generated successfully');
      return imageUrl;

    } catch (error: any) {
      console.error('❌ Error generating image:', error);
      
      if (error.message.includes('fetch')) {
        throw new Error('Network error: Please check your internet connection and try again.');
      }
      
      throw error;
    }
  }

  /**
   * Generate a smart image prompt based on business info and ad content
   */
  static generateSmartImagePrompt(businessInfo: BusinessInfo, adContent: AdContent): string {
    const { businessName, productService, targetCustomer, industry, brandTone } = businessInfo;
    const { headline, body, platform } = adContent;

    // Platform-specific image specifications
    const platformSpecs = platform === 'facebook' 
      ? 'optimized for social media, eye-catching and scroll-stopping'
      : 'professional and trustworthy for search advertising';

    // Create a comprehensive prompt for DALL-E 3
    const prompt = `Create a professional marketing image for ${businessName}, a ${industry} business. 

Business Context:
- Service: ${productService}
- Target audience: ${targetCustomer}
- Brand tone: ${brandTone}

Ad Content:
- Headline: "${headline}"
- Message: "${body}"

Style Requirements:
- ${platformSpecs}
- High quality, professional photography style
- Modern, clean composition
- Colors that convey ${brandTone} feeling
- Include subtle branding elements if appropriate
- Perfect for ${platform} advertising
- Photorealistic, not cartoon or illustration
- Well-lit, sharp focus
- Lifestyle or business setting as appropriate

Technical specs: High resolution, suitable for digital advertising, visually compelling and professional.`;

    return prompt;
  }

  /**
   * Generate a contextual image prompt based on ad content
   */
  static generateContextualImagePrompt(businessInfo: BusinessInfo, adContent: AdContent): string {
    const isAlmaLinks = businessInfo.businessName.toLowerCase().includes('alma');
    
    if (isAlmaLinks) {
      // Specialized prompt for AlmaLinks events
      return `Professional networking event photography: Elegant business conference setting with diverse group of well-dressed executives and CEOs networking. Modern, sophisticated venue with warm lighting. People engaged in meaningful professional conversations. High-end conference center or business lounge atmosphere. Professional business attire. Candid moments of connection and collaboration between Jewish business leaders. Lifestyle photography style, natural lighting, welcoming and upscale environment. Perfect for ${adContent.platform} advertising.`;
    }

    // General business prompt
    return this.generateSmartImagePrompt(businessInfo, adContent);
  }

  /**
   * Generate basic image prompt for quick generation
   */
  static generateBasicImagePrompt(businessInfo: BusinessInfo, platform: 'facebook' | 'google'): string {
    const platformStyle = platform === 'facebook' 
      ? 'vibrant, social media optimized' 
      : 'clean, professional, trustworthy';

    return `Professional ${businessInfo.industry} business image, ${platformStyle} style, high quality photography, modern and appealing, suitable for ${platform} advertising.`;
  }
}

export default OpenAIService;