export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
