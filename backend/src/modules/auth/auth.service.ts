import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Auth service: integrates with Better Auth.
 * Phase 1: email/password authentication.
 * userId is optional FK on trade/alert tables (nullable now, required later).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate user by email. In production, this delegates to Better Auth.
   */
  async validateUser(email: string): Promise<{ id: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? { id: user.id, email: user.email } : null;
  }

  /**
   * Create a new user (sign up).
   */
  async createUser(data: { email: string; name?: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        preferences: {
          create: {}, // Use defaults
        },
      },
      include: { preferences: true },
    });
  }

  /**
   * Get user by ID.
   */
  async getUserById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { preferences: true },
    });
  }
}
