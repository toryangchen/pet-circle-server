import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { PhoneAuthorizationRequiredException } from '../exceptions/phone-authorization-required.exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = this.toApiError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json({
      code,
      message,
      data: null,
    });
  }

  private toApiError(exception: unknown) {
    if (exception instanceof PhoneAuthorizationRequiredException) {
      return {
        status: exception.getStatus(),
        code: 40006,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    if (exception instanceof UnauthorizedException) {
      return {
        status: exception.getStatus(),
        code: 40002,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    if (exception instanceof ForbiddenException) {
      return {
        status: exception.getStatus(),
        code: 40003,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    if (exception instanceof NotFoundException) {
      return {
        status: exception.getStatus(),
        code: 40004,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    if (exception instanceof BadRequestException) {
      return {
        status: exception.getStatus(),
        code: 40001,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    if (exception instanceof ConflictException) {
      return {
        status: exception.getStatus(),
        code: 40005,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        code: 50000,
        message: this.getHttpExceptionMessage(exception),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 50000,
      message: 'Internal server error.',
    };
  }

  private getHttpExceptionMessage(exception: HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const { message, error } = response as {
        message?: string | string[];
        error?: string;
      };

      if (Array.isArray(message)) {
        return message.join('; ');
      }

      if (typeof message === 'string') {
        return message;
      }

      if (typeof error === 'string') {
        return error;
      }
    }

    return exception.message;
  }
}
