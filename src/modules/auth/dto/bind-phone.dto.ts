import { IsNotEmpty, IsString } from 'class-validator';

export class BindPhoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
