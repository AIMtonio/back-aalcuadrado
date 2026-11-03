import { BlockList, isIPv4 } from 'node:net';
import type { Request } from 'express';

/**
 * Redes desde las que llega cloudflared: la propia máquina o una red privada
 * (otro contenedor de Docker, el gateway de Docker o la red de la casa).
 */
const REDES_PROPIAS = new BlockList();
REDES_PROPIAS.addSubnet('127.0.0.0', 8, 'ipv4');
REDES_PROPIAS.addSubnet('10.0.0.0', 8, 'ipv4');
REDES_PROPIAS.addSubnet('172.16.0.0', 12, 'ipv4');
REDES_PROPIAS.addSubnet('192.168.0.0', 16, 'ipv4');
REDES_PROPIAS.addAddress('::1', 'ipv6');
REDES_PROPIAS.addSubnet('fc00::', 7, 'ipv6');

function esDeRedPropia(ip: string): boolean {
  // "::ffff:172.18.0.3" es una IPv4 escrita como IPv6.
  const v4 = ip.replace(/^::ffff:/i, '');
  if (isIPv4(v4)) return REDES_PROPIAS.check(v4, 'ipv4');
  return REDES_PROPIAS.check(ip, 'ipv6');
}

/**
 * La IP real del visitante, para los límites por persona.
 *
 * Detrás del túnel, quien se conecta a la API es cloudflared y la IP del
 * visitante viaja en `CF-Connecting-IP`. Ese encabezado solo se cree si la
 * conexión viene de la propia máquina o de una red privada (es decir, de
 * cloudflared); desde internet nadie llega directo a la API. Así funciona
 * aunque `TRUST_PROXY` no incluya la IP de Docker. Si no, se usa `req.ip`.
 */
export function ipDelVisitante(req: Request): string {
  const conexion = req.socket?.remoteAddress ?? '';
  const deCloudflare = req.headers['cf-connecting-ip'];
  if (
    typeof deCloudflare === 'string' &&
    deCloudflare.trim() &&
    esDeRedPropia(conexion)
  ) {
    return deCloudflare.trim();
  }
  return req.ip ?? conexion;
}
