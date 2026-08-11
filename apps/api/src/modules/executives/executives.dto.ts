import { IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Status } from '../../database/schemas/domain.schemas';
export class CreateExecutiveDto { @IsString() employeeId: string; @IsString() name: string; @IsEmail() email: string; @IsDateString() doj: string; @IsEnum(Status) status: Status; @IsOptional() @IsString() managerId?: string; @IsString() source: string; }
export class UpdateExecutiveDto { @IsOptional() @IsString() name?: string; @IsOptional() @IsEmail() email?: string; @IsOptional() @IsDateString() doj?: string; @IsOptional() @IsEnum(Status) status?: Status; @IsOptional() @IsString() managerId?: string; @IsOptional() @IsString() source?: string; }
