import { StructuredToolInterface } from '@langchain/core/tools';

export interface AgentTool {
  create(userId: string): StructuredToolInterface;
}
