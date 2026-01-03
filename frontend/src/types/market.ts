export interface StockData {
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  url: string;
  publishedAt: string;
}

export interface SentimentScore {
  score: number;
  trend: 'up' | 'down' | 'stable';
  timestamp: string;
}
