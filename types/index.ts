export interface QANode {
  id: string;
  question: string;
  answer?: string;
  children: QANode[];
  questionNumber?: number;
} 