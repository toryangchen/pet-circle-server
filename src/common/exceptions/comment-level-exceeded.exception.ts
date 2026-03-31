import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

export class CommentLevelExceededException extends HttpException {
  constructor(message = 'Only first-level comments can be replied to.') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
