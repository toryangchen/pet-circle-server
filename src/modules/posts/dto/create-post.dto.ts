import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { NeuteredStatus, PostType, ServiceCategory } from '@prisma/client';

class PostContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  wechatId?: string;

  @IsOptional()
  @Matches(/^1\d{10}$/)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactName?: string;
}

class AdoptionDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  petType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  age!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  gender!: string;

  @IsEnum(NeuteredStatus)
  neuteredStatus!: NeuteredStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  adoptionRequirements!: string;
}

class SecondHandDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCondition!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  price!: string;
}

class OtherDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  infoType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  area!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  budget!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;
}

class HomeFeedingDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serviceArea!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  availableTime!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  price!: string;
}

class BoardingDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  boardingEnvironment!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  acceptedPetTypes!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  price!: string;
}

export class CreatePostDto {
  @IsEnum(PostType)
  type!: PostType;

  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  city!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsUrl({}, { each: true })
  images!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PostContactDto)
  contact?: PostContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdoptionDetailDto)
  adoptionDetail?: AdoptionDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecondHandDetailDto)
  secondHandDetail?: SecondHandDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OtherDetailDto)
  otherDetail?: OtherDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HomeFeedingDetailDto)
  homeFeedingDetail?: HomeFeedingDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoardingDetailDto)
  boardingDetail?: BoardingDetailDto;
}

export type CreatePostContactDto = CreatePostDto['contact'];
