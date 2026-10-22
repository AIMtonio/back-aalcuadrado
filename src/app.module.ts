import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { validarEntorno, type Entorno } from './config/entorno.js';
import { ImagenesModule } from './imagenes/imagenes.module.js';
import { ProductosModule } from './productos/productos.module.js';
import { PublicacionModule } from './publicacion/publicacion.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

/** Módulos con endpoints. Las pruebas e2e los montan sobre otra base de datos. */
export const MODULOS_DE_NEGOCIO = [
  UsuariosModule,
  AuthModule,
  ImagenesModule,
  ProductosModule,
  PublicacionModule,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validarEntorno,
    }),
    // Límite general: 120 peticiones por minuto por IP. El login tiene uno más estricto.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>) => ({
        type: 'mysql',
        host: config.get('DB_HOST', { infer: true }),
        port: config.get('DB_PORT', { infer: true }),
        username: config.get('DB_USER', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database: config.get('DB_NAME', { infer: true }),
        charset: 'utf8mb4_unicode_ci',
        timezone: 'Z',
        autoLoadEntities: true,
        // Las tablas las crean los scripts de database/. El usuario de la app no tiene permisos para alterarlas.
        synchronize: false,
        retryAttempts: 5,
      }),
    }),
    ...MODULOS_DE_NEGOCIO,
  ],
})
export class AppModule {}
