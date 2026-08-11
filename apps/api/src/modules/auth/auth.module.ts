import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { Role, RoleSchema, User, UserSchema } from '../../database/schemas/domain.schemas';

@Module({
  imports: [PassportModule, JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any } }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: Role.name, schema: RoleSchema }])],
  controllers: [AuthController], providers: [AuthService, GoogleStrategy], exports: [AuthService, JwtModule]
})
export class AuthModule {}
