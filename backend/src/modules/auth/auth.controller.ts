import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() body: { email: string; name?: string }) {
    return this.authService.createUser(body);
  }

  @Post('login')
  async login(@Body() body: { email: string }) {
    // Phase 1: simplified login (Better Auth will handle full flow)
    const user = await this.authService.validateUser(body.email);
    if (!user) {
      return { error: 'User not found' };
    }
    return { user };
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.authService.getUserById(id);
  }
}
