import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { UsersModule } from '../users/users.module';
import { ChatModelAction } from './actions/chat.action';
import { MessageModelAction } from './actions/message.action';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { AgentService } from './agent.service';
import { AlertReader } from './agent-tools/alert-reader';
import { MetricsReader } from './agent-tools/metrics-reader';
import { SavingsReader } from './agent-tools/savings-reader';
import { SystemInsightsReader } from './agent-tools/system-insights-reader';
import { AlertsModule } from '../alerts/alerts.module';
import { InvertersMetricsModule } from '../inverters-metrics/inverters-metrics.module';
import { InvertersModule } from '../inverters/inverters.module';

@Module({
  providers: [
    AgentService,
    AlertReader,
    MetricsReader,
    SavingsReader,
    SystemInsightsReader,
    ChatGateway,
    ChatService,
    ChatModelAction,
    MessageModelAction,
  ],
  controllers: [ChatController],
  imports: [
    AlertsModule,
    InvertersMetricsModule,
    InvertersModule,
    TypeOrmModule.forFeature([Chat, Message]),
    UsersModule,
  ],
})
export class ChatbotModule {}
