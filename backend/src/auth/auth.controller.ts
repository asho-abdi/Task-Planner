import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '../common/constants';
import { Public } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/workspace.decorators';
import type { AuthUser } from '../common/types/request-context';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(dto, response);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, response);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  async refresh(
    @CurrentUser() authUser: AuthUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.usersService.findByIdOrThrow(authUser.id);
    const refreshToken = readRefreshCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    return this.authService.refresh(user, refreshToken, response);
  }

  @Public()
  @Post('logout')
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logout(response, readRefreshCookie(request));
  }

  @Get('me')
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.usersService.findByIdOrThrow(authUser.id);
    return this.usersService.toPublicUser(user);
  }
}

function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as
    Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}
