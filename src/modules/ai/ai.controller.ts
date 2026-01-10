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
}
