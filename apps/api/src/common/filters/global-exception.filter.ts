import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = error instanceof HttpException ? error.getResponse() : { message: 'Internal server error' };
    response.status(status).json({ statusCode: status, error: detail, path: request.url, timestamp: new Date().toISOString(), correlationId: request.headers['x-correlation-id'] ?? randomUUID() });
  }
}
