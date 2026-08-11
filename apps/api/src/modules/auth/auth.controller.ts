import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
class LoginDto { @IsEmail() email: string; @IsString() @MinLength(8) password: string; }
class RefreshDto { @IsString() refreshToken: string; }
@ApiTags('Authentication') @Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }
  @Public() @Get('google') @UseGuards(AuthGuard('google')) google() { return undefined; }
  @Public() @Get('google/callback') @UseGuards(AuthGuard('google')) async callback(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.auth.googleLogin(req.user as any);
    res.redirect(`${process.env.WEB_URL ?? 'http://localhost:3000'}/login?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`);
  }
}
