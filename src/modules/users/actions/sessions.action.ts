import { AbstractModelAction } from '@hng-sdk/orm';
import { Session } from '../entities/sessions.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export class SessionModelAction extends AbstractModelAction<Session> {
  constructor(@InjectRepository(Session) repository: Repository<Session>) {
    super(repository, Session);
  }

  findById(id: string): Promise<Session | null> {
    return this.get({ identifierOptions: { id } });
  }

  /**
   * Atomically replaces the refresh token hash only when the current stored
   * hash matches `expectedHash`. Returns true if the row was updated (i.e.
   * the old token was successfully claimed), false if another request already
   * swapped it first.
   *
   * The sliding-window expiresAt is extended by 7 days but never past the
   * absolute 30-day cap derived from the session's createdAt.
   */
  async compareAndSwapRefreshTokenHash(
    sessionId: string,
    expectedHash: string,
    newHash: string,
    createdAt: Date,
  ): Promise<boolean> {
    const SLIDING_MS = 7 * 24 * 60 * 60 * 1000;
    const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

    const absoluteCap = new Date(createdAt.getTime() + ABSOLUTE_MS);
    const slidingWindow = new Date(Date.now() + SLIDING_MS);
    const newExpiresAt =
      slidingWindow < absoluteCap ? slidingWindow : absoluteCap;

    const result = await this.repository
      .createQueryBuilder()
      .update(Session)
      .set({
        refreshTokenHash: newHash,
        lastActivityAt: new Date(),
        expiresAt: newExpiresAt,
      })
      .where('id = :id AND refresh_token_hash = :expectedHash', {
        id: sessionId,
        expectedHash,
      })
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
