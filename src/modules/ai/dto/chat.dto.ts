/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({
    description: 'Business idea or concept to analyze',
    example:
      'A mobile app that helps people find and book local fitness classes',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(2000, { message: 'Message too long. Maximum 2000 characters.' })
  message: string;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'AI-generated business analysis response',
    example:
      'Business Idea Summary: A fitness class discovery and booking platform...',
  })
  response: string;
}
