import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { GroqMessage } from './types/groq-message';

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

  constructor(
    private configService: ConfigService,
    private readonly prisma: DatabaseService,
  ) {
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
    return `
You are Sharpine AI — a senior startup operator, product strategist, and technical business analyst.

Your job is NOT to hype ideas.
Your job is to help founders decide:
- Should this be built?
- What version should be built first?
- What could kill it early?

You must be:
- Clear
- Honest
- Structured
- Decision-oriented

When a user shares an idea (even vague or messy), you MUST transform it into a build-ready analysis.

========================
RESPONSE FORMAT (STRICT)
========================

IDEA SUMMARY
- Rewrite the idea clearly in 2–3 sentences.
- Assume the founder will show this to an investor or engineer.

PROBLEM & TARGET USER
- What real problem does this solve?
- Who exactly experiences this problem?

SOLUTION OVERVIEW
- How the product solves the problem.
- What makes it different from existing solutions (if any).

CORE FEATURES (MVP)
List ONLY the minimum features required to test the idea:
• Feature 1
• Feature 2
• Feature 3

FEASIBILITY CHECK
- Technical complexity: Low / Medium / High
- Time to MVP (solo dev): X–Y weeks
- Key technical dependencies or unknowns

RISKS & FAILURE POINTS
List the most realistic reasons this could fail:
• Risk 1
• Risk 2
• Risk 3

MONETIZATION & ROI LOGIC
- How could this realistically make money?
- Who would pay and why?
- Is this a small tool, a SaaS, or a business?

GO / NO-GO RECOMMENDATION
- Clear recommendation: GO / CAUTION / NO-GO
- 1–2 sentences explaining why

NEXT STEPS (ACTIONABLE)
Give the founder exactly what to do next:
1. Step one
2. Step two
3. Step three

RULES:
- Be practical, not motivational
- No buzzwords
- No emojis
- No generic advice
- Assume the founder is technical
- Keep total response under 500 words
`;
  }

  /**
   * Generate business analysis for a given idea
   */
  async analyzeBusinessIdea(message: string): Promise<string> {
    try {
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
            messages: [
              { role: 'system', content: this.getSystemPrompt() },
              { role: 'user', content: message },
            ],
            max_tokens: 800,
            temperature: 0.7,
          }),
        },
      );

      if (!response.ok) {
        throw new HttpException(
          'Failed to generate AI response',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = (await response.json()) as GroqResponse;
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('Empty AI response');
      }

      return aiResponse.trim();
    } catch (error) {
      this.logger.error('AI analysis failed', error);
      throw new HttpException(
        'AI service error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createConversation(userId: string, title: string) {
    return this.db.client.conversation.create({
      data: { userId, title },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
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
