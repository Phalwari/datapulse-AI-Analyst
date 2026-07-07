export interface ColumnMetadata {
  name: string;
  type: 'numeric' | 'string' | 'date' | 'boolean';
  stats?: {
    min?: number;
    max?: number;
    mean?: number;
    uniqueCount?: number;
    missingCount: number;
  };
}

export interface Dataset {
  name: string;
  columns: ColumnMetadata[];
  rows: Record<string, any>[];
  rowCount: number;
}

export interface VisualRecommendation {
  id: string;
  type: 'bar' | 'line' | 'area' | 'scatter' | 'pie' | 'radar';
  title: string;
  xAxisKey: string;
  yAxisKeys: string[];
  aggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max';
  colors?: string[];
  description: string;
  summary: string;
}

export interface Insight {
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'trend' | 'anomaly';
  metric?: string;
  value?: string;
}

export interface AutoAnalysis {
  summary: string;
  businessQuestions: string[];
  insights: Insight[];
  charts: VisualRecommendation[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: string;
  chart?: VisualRecommendation; // If the assistant generated a chart
  chartData?: Record<string, any>[]; // Specific SQL query result rows
  suggestedQuestions?: string[];
}

// Dashboard and Stats Integration
export interface PinnedItem {
  id: string;
  type: 'chart' | 'stat';
  chartConfig?: VisualRecommendation;
  chartData?: Record<string, any>[]; // Keep query result records preserved
  statConfig?: {
    type: 'regression' | 'forecast' | 'anomaly';
    title: string;
    description: string;
    xAxisKey: string;
    yAxisKeys: string[];
    summaryMetrics: { label: string; value: string | number }[];
  };
  pinnedAt: string;
}

