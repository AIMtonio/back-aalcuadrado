import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Color } from './color.entity.js';
import {
  ColoresController,
  ColoresKitsCompatController,
} from './colores.controller.js';
import { ColoresService } from './colores.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Color])],
  controllers: [ColoresController, ColoresKitsCompatController],
  providers: [ColoresService],
  exports: [ColoresService],
})
export class ColoresModule {}
