import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private log = new Logger('Errores');
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof HttpException) {
      const body = e.getResponse();
      return res.status(e.getStatus()).json(typeof body === 'string' ? { message: body } : body);
    }
    const pg = e?.cause?.code ?? e?.code;
    if (pg === '23503') return res.status(409).json({ message: 'El registro está relacionado con otra información y no puede modificarse o eliminarse' });
    if (pg === '23505') return res.status(409).json({ message: 'Ya existe un registro con esos datos' });
    if (pg === '22P02') return res.status(400).json({ message: 'Identificador inválido' });
    if (e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'El archivo supera el tamaño máximo permitido' });
    this.log.error(e?.stack || e);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
