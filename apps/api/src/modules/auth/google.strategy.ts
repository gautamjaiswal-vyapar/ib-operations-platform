import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() { super({ clientID: process.env.GOOGLE_CLIENT_ID || 'disabled', clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'disabled', callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback', scope: ['email', 'profile'] }); }
  validate(_access: string, _refresh: string, profile: Profile) { return { googleId: profile.id, email: profile.emails?.[0]?.value, name: profile.displayName }; }
}
