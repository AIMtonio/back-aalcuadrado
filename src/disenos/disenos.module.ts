import { Module } from '@nestjs/common';
import { DisenosController } from './disenos.controller.js';
import { DisenosService } from './disenos.service.js';

@Module({
  controllers: [DisenosController],
  providers: [DisenosService],
})
export class DisenosModule {}
