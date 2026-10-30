import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

const isDatabaseUnavailable = (exception: unknown) =>
  exception instanceof Error &&
  (exception.name === 'PrismaClientInitializationError' || /Can't reach database server/i.test(exception.message));

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as any).message;
      } else {
        message = res;
      }
    }

    // Full details (database errors, stack traces) stay in the server log only
    const detail =
      exception instanceof Error ? exception.message : typeof message === 'object' ? JSON.stringify(message) : message;
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status ${status} - Error: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      // Unexpected errors (database, code) get a generic message; deliberate HTTP errors keep theirs
      if (!(exception instanceof HttpException)) {
        message = isDatabaseUnavailable(exception)
          ? 'The database is not reachable right now. Please try again shortly.'
          : 'Something went wrong on the server. Please try again.';
      }
    } else {
      // Expected client errors (401, 404, validation): one short line, no stack trace
      this.logger.warn(`[${request.method}] ${request.url.split('?')[0]} - Status ${status} - ${detail}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url.split('?')[0],
      message,
    });
  }
}
