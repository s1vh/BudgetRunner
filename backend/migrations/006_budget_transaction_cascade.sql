ALTER TABLE budget_period_transactions
  DROP CONSTRAINT budget_period_transactions_transaction_id_fkey,
  ADD CONSTRAINT budget_period_transactions_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;

ALTER TABLE reward_allocations
  DROP CONSTRAINT reward_allocations_transaction_id_fkey,
  ADD CONSTRAINT reward_allocations_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;
