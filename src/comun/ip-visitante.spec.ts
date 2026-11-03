import type { Request } from 'express';
import { ipDelVisitante } from './ip-visitante.js';

const pedido = (conexion: string, cabeceras: Record<string, string> = {}) =>
  ({
    socket: { remoteAddress: conexion },
    headers: cabeceras,
    ip: conexion,
  }) as unknown as Request;

describe('ipDelVisitante', () => {
  it('usa CF-Connecting-IP cuando la conexión viene de cloudflared', () => {
    const cf = { 'cf-connecting-ip': '203.0.113.9' };
    // Misma máquina, contenedor de Docker, gateway de Docker e IPv4 escrita como IPv6.
    for (const conexion of [
      '127.0.0.1',
      '::1',
      '172.18.0.3',
      '::ffff:172.17.0.1',
      '192.168.1.21',
    ]) {
      expect(ipDelVisitante(pedido(conexion, cf))).toBe('203.0.113.9');
    }
  });

  it('ignora CF-Connecting-IP si la conexión viene de internet', () => {
    expect(
      ipDelVisitante(pedido('198.51.100.4', { 'cf-connecting-ip': '1.2.3.4' })),
    ).toBe('198.51.100.4');
  });

  it('sin el encabezado, usa req.ip', () => {
    expect(ipDelVisitante(pedido('127.0.0.1'))).toBe('127.0.0.1');
  });
});
