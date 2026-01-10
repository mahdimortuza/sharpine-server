// src/modules/ai/ai.service.ts - GROQ VERSION (FREE & FAST!)
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.error('GROQ_API_KEY is not configured');
      throw new Error('AI service is not properly configured');
    }

    this.apiKey = apiKey;
  }

  /**
   * System prompt that instructs AI to behave as a business analyst
   */
  private getSystemPrompt(): string {
    return `You are a professional business analyst. When analyzing a business idea, provide:

1. SUMMARY: A clear 1-2 sentence overview of the business concept
2. CORE FEATURES: List 3-5 essential features the product/service should have
3. RISKS & CONSIDERATIONS: List 3-5 key challenges, risks, or important considerations

Guidelines:
- Be concise, professional, and actionable
- Focus on practical insights
- Keep total response under 300 words
- Use bullet points for features and risks
- Be realistic but constructive

Format your response exactly like this:

SUMMARY:
[Your 1-2 sentence summary]

CORE FEATURES:
• [Feature 1]
• [Feature 2]
• [Feature 3]

RISKS & CONSIDERATIONS:
• [Risk 1]
• [Risk 2]
• [Risk 3]`;
  }

  /**
   * Generate business analysis for a given idea
   */
  async analyzeBusinessIdea(message: string): Promise<string> {
    try {
      this.logger.log(
        `Processing AI chat request: ${message.substring(0, 50)}...`,
      );

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile', // Fast and high quality
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt(),
              },
              {
                role: 'user',
                content: message,
              },
            ],
            max_tokens: 800,
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Groq API error: ${response.status} - ${errorText}`);

        if (response.status === 401) {
          throw new HttpException(
            'AI service authentication failed. Please check your API key.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        if (response.status === 429) {
          throw new HttpException(
            'AI service rate limit exceeded. Please try again in a moment.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        throw new HttpException(
          'Failed to generate AI response. Please try again.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const json: unknown = await response.json();

      if (!json || typeof json !== 'object' || !('choices' in json)) {
        throw new Error('Unexpected Groq API response format');
      }

      const data = json as GroqResponse;

      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from Groq');
      }

      this.logger.log('✅ AI response generated successfully');
      return aiResponse.trim();
    } catch (error) {
      this.logger.error('Error calling Groq API:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to generate AI response. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
