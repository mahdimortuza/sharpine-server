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

  async createConversation(userId: string, title?: string): Promise<any> {
    return this.prisma.conversation.create({
      data: {
        userId,
        title: title || 'New Conversation',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string): Promise<any[]> {
    return this.prisma.conversation.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1, // Only get first message for preview
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });
  }

  /**
   * Generate title from first user message
   */
  private generateTitle(message: string): string {
    // Take first 50 characters or until first newline
    const title = message.split('\n')[0].substring(0, 50);
    return title.length < message.length ? `${title}...` : title;
  }

  /**
   * Build message history for AI context
   */
  private buildMessageHistory(messages: any[]): GroqMessage[] {
    const history: GroqMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
    ];

    // Add previous messages for context
    messages.forEach((msg) => {
      history.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    });

    return history;
  }

  /**
   * Chat with AI (with conversation memory)
   */
  async chat(
    userId: string,
    message: string,
    conversationId?: string,
  ): Promise<{
    conversationId: string;
    response: string;
    userMessage: any;
    assistantMessage: any;
  }> {
    try {
      this.logger.log(
        `Processing chat request: ${message.substring(0, 50)}...`,
      );

      let conversation;

      // Get or create conversation
      if (conversationId) {
        conversation = await this.getConversation(conversationId, userId);
      } else {
        // Create new conversation with auto-generated title
        conversation = await this.createConversation(
          userId,
          this.generateTitle(message),
        );
      }

      // Save user message
      const userMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: message,
        },
      });

      // Build conversation history for AI context
      const messageHistory = this.buildMessageHistory([
        ...conversation.messages,
        { role: 'user', content: message },
      ]);

      // Call Groq API with full conversation context
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messageHistory,
            max_tokens: 1000,
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Groq API error: ${response.status} - ${errorText}`);
        throw new HttpException(
          'Failed to generate AI response',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data: GroqResponse = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from Groq');
      }

      // Save assistant message
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: aiResponse,
        },
      });

      // Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      this.logger.log('✅ AI response generated and saved successfully');

      return {
        conversationId: conversation.id,
        response: aiResponse.trim(),
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      this.logger.error('Error in chat service:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to process chat request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
