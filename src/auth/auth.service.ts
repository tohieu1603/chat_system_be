import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

interface AuthResult extends TokenPair {
  user: Omit<User, 'password_hash' | 'refresh_token_hash' | 'password_reset_token'>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already registered`);
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      password_hash,
      full_name: dto.full_name,
      phone: dto.phone,
      company_name: dto.company_name,
      company_size: dto.company_size,
      industry: dto.industry,
    });

    this.logger.log(`User registered: id=${user.id}`);
    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!isMatch) {
      this.logger.warn(`Failed login attempt: email=${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user);
    await this.usersService.update(user.id, { last_login_at: new Date() });
    this.logger.log(`User logged in: id=${user.id}`);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async generateTokens(user: User): Promise<TokenPair> {
    const expiresIn = (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as JwtSignOptions['expiresIn'];
    const refreshExpiresIn = (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d') as JwtSignOptions['expiresIn'];

    const payload = { sub: user.id, role: user.role };

    const access_token = this.jwtService.sign(payload, { expiresIn });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: refreshExpiresIn });

    const refresh_token_hash = await bcrypt.hash(refresh_token, BCRYPT_ROUNDS);
    await this.usersService.update(user.id, { refresh_token_hash });

    return { access_token, refresh_token };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.usersService.findWithRefreshToken(userId);
    if (!user || !user.refresh_token_hash) {
      throw new UnauthorizedException('Access denied');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!isMatch) {
      this.logger.warn(`Invalid refresh token attempt: userId=${userId}`);
      throw new UnauthorizedException('Access denied');
    }

    this.logger.log(`Tokens refreshed: userId=${userId}`);
    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.update(userId, { refresh_token_hash: undefined });
    this.logger.log(`User logged out: id=${userId}`);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    // Always return same message to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.usersService.update(user.id, {
      password_reset_token: hashedToken,
      password_reset_expires: expiresAt,
    });

    this.logger.log(`Password reset token generated: userId=${user.id}`);
    // In production: send rawToken via email.
    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.usersService.findWithResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.password_reset_expires || user.password_reset_expires < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.update(user.id, {
      password_hash,
      password_reset_token: undefined,
      password_reset_expires: undefined,
      refresh_token_hash: undefined,
    });

    this.logger.log(`Password reset successful: userId=${user.id}`);
  }

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, refresh_token_hash, password_reset_token, ...safe } = user as any;
    return safe;
  }
}
