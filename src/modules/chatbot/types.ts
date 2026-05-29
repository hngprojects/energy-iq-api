export type CardType = 'summary' | 'insight' | 'anomaly' | 'recommendation';

export interface AgentCard {
  cardType: CardType;
  title: string;
  content: string;
  /** Only present on anomaly cards */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentCardResponse {
  cards: AgentCard[];
}
