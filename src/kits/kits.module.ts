import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitsController } from './kits.controller.js';
import { KitsService } from './kits.service.js';
import { KitAroma, KitColor } from './opciones-kit.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([KitColor, KitAroma])],
  controllers: [KitsController],
  providers: [KitsService],
})
export class KitsModule {}
