import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Auth service: wraps Better Auth for application-level user queries.
 * Better Auth handles sign-up, login, sessions via /api/auth/* routes.
 * This service provides user lookup for other modules that need user context.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by email (for internal lookups).
   */
  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Get user by ID (for internal lookups).
   */
  async getUserById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { preferences: true },
    });
  }
}
