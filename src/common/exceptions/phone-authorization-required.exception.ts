import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

export class PhoneAuthorizationRequiredException extends HttpException {
  constructor(message = 'Phone binding is required before publishing.') {
    super(message, HttpStatus.FORBIDDEN);
  }
}
