import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CreateExecutiveDto, UpdateExecutiveDto } from './executives.dto';
import { ExecutivesService } from './executives.service';
@ApiTags('Executives') @ApiBearerAuth() @Controller('executives')
export class ExecutivesController { constructor(private readonly service: ExecutivesService) {} @Get() @RequirePermissions('executives:read') list(@Query('active') active?: string) { return this.service.list(active === undefined ? undefined : active === 'true'); } @Post() @RequirePermissions('executives:write') create(@Body() dto: CreateExecutiveDto) { return this.service.create(dto); } @Patch(':id') @RequirePermissions('executives:write') update(@Param('id') id: string, @Body() dto: UpdateExecutiveDto) { return this.service.update(id, dto); } }
