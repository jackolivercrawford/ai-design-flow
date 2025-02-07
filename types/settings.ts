export interface KnowledgeBaseSource {
  id: string;
  type: 'file' | 'text';
  name: string;
  content?: string;
  file?: File;
  processedContent?: {
    requirements?: string[];
    technicalSpecifications?: string[];
    designGuidelines?: string[];
    userPreferences?: string[];
    industryStandards?: string[];
    [key: string]: any;
  };
}

export interface QASettings {
  traversalMode: 'bfs' | 'dfs';
  unknownHandling: 'auto' | 'prompt';
  conflictResolution: 'auto' | 'manual';
  maxQuestions?: number;
  knowledgeBase?: KnowledgeBaseSource[];
} 