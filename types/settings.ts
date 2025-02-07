export interface QASettings {
  traversalMode: 'bfs' | 'dfs';
  unknownHandling: 'auto' | 'prompt';
  conflictResolution: 'auto' | 'manual';
  maxQuestions?: number;
  knowledgeBase?: File;
} 