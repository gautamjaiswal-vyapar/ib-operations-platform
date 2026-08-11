import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role, User } from '../../database/schemas/domain.schemas';

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>, @InjectModel(Role.name) private readonly roles: Model<Role>, private readonly jwt: JwtService) {}
  async login(email: string, password: string) {
    const user = await this.users.findOne({ email: email.toLowerCase(), active: true }).select('+passwordHash +refreshTokenHash');
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }
  async googleLogin(profile: { googleId: string; email: string; name: string }) {
    const user = await this.users.findOneAndUpdate({ email: profile.email.toLowerCase() }, { $set: { googleId: profile.googleId, name: profile.name, active: true }, $setOnInsert: { roles: ['viewer'] } }, { upsert: true, new: true });
    return this.issueTokens(user);
  }
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      const user = await this.users.findById(payload.sub).select('+refreshTokenHash');
      if (!user?.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) throw new Error();
      return this.issueTokens(user);
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
  }
  private async issueTokens(user: any) {
    const roleDocs = await this.roles.find({ name: { $in: user.roles } }).lean();
    const permissions = [...new Set(roleDocs.flatMap((role) => role.permissions))];
    const payload = { sub: String(user._id), email: user.email, name: user.name, roles: user.roles, permissions };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync({ sub: String(user._id) }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any });
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12); await user.save();
    return { accessToken, refreshToken, user: payload };
  }
}
