import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import {
  API_TOKEN_EXPIRATIONS,
  API_TOKEN_SCOPES,
  type ApiTokenExpiration,
  type ApiTokenScope,
} from '../api-token-scopes';

export class CreateApiTokenDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(API_TOKEN_SCOPES, { each: true })
  scopes!: ApiTokenScope[];

  @IsOptional()
  @IsIn(API_TOKEN_EXPIRATIONS)
  expiration?: ApiTokenExpiration;
}
