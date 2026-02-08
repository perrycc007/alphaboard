import { Module } from '@nestjs/common';
import { PaperBrokerAdapter } from './paper-broker.adapter';

@Module({
  providers: [
    {
      provide: 'BROKER_PORT',
      useClass: PaperBrokerAdapter,
    },
    PaperBrokerAdapter,
  ],
  exports: ['BROKER_PORT', PaperBrokerAdapter],
})
export class BrokerModule {}
