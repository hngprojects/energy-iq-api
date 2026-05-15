import { EntityManager } from 'typeorm';

/**
 * Shared helpers for database transaction control.
 *
 * Use `noTransaction()` for simple operations that do not need rollback support.
 * Use `withTransaction(transaction)` when several database changes must succeed
 * or fail together, and pass the active `EntityManager` from the current scope.
 */

export const noTransaction = () => ({
  transactionOptions: { useTransaction: false as const },
});

/**
 * Builds transaction options for a live transaction context.
 * The caller is responsible for creating or receiving the `EntityManager`
 * and passing it into the operation that should participate in the transaction.
 */
export const withTransaction = (transaction: EntityManager) => ({
  transactionOptions: { useTransaction: true as const, transaction },
});
