import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze business idea with AI',
    description:
      'Send a business idea and receive AI-powered analysis including summary, features, and risks',
  })
  @ApiResponse({
    status: 200,
    description: 'AI analysis generated successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  @ApiResponse({
    status: 503,
    description: 'AI service unavailable',
  })
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    const response = await this.aiService.analyzeBusinessIdea(
      chatRequest.message,
    );

    return {
      response,
    };
  }
  @Post('conversations')
  @ApiOperation({ summary: 'Create new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created',
    type: ConversationResponseDto,
  })
  async createConversation(
    @Req() req: any,
    @Body() createDto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    const userId = req.user.id;
    return this.aiService.createConversation(userId, createDto.title);
  }

  /**
   * Get all user conversations
   */
  @Get('conversations')
  @ApiOperation({ summary: 'Get all user conversations' })
  @ApiResponse({
    status: 200,
    description: 'List of conversations',
    type: [ConversationResponseDto],
  })
  async getConversations(@Req() req: any): Promise<ConversationResponseDto[]> {
    const userId = req.user.id;
    return this.aiService.getUserConversations(userId);
  }

  /**
   * Get specific conversation with all messages
   */
  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
    type: ConversationResponseDto,
  })
  async getConversation(
    @Req() req: any,
    @Param('id') conversationId: string,
  ): Promise<ConversationResponseDto> {
    const userId = req.user.id;
    return this.aiService.getConversation(conversationId, userId);
  }

  /**
   * Delete a conversation
   */
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete conversation' })
  @ApiResponse({
    status: 204,
    description: 'Conversation deleted',
  })
  async deleteConversation(
    @Req() req: any,
    @Param('id') conversationId: string,
  ): Promise<void> {
    const userId = req.user.id;
    await this.aiService.deleteConversation(conversationId, userId);
  }
}
