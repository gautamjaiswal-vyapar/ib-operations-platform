import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CurrentUser, RequirePermissions } from '../../common/decorators/auth.decorators';
import { Tenurity } from '../../database/schemas/domain.schemas';
import { CreateTarget, TargetsService } from './targets.service';
class CreateTargetDto implements CreateTarget { @IsString() source:string; @IsEnum(Tenurity) tenurity:Tenurity; @IsDateString() effectiveFrom:string; @IsNumber() @Min(0) revenue:number; @IsNumber() @Min(0) login:number; @IsNumber() @Min(0) demo:number; @IsNumber() @Min(0) license:number; @IsNumber() @Min(0) proPlatform:number; @IsNumber() @Min(0) arpl:number; }
@ApiTags('Targets') @ApiBearerAuth() @Controller('targets')
export class TargetsController { constructor(private readonly service:TargetsService){} @Get() @RequirePermissions('targets:read') list(@Query('includeArchived') all?:string){return this.service.list(all==='true');} @Post('versions') @RequirePermissions('targets:write') create(@Body() dto:CreateTargetDto,@CurrentUser() user:any){return this.service.createVersion(dto,user.sub);} }
