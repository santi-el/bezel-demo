export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'bet'
  | 'payout'
  | 'hold'
  | 'fee'
  | 'offer'
  | 'gfd_refund';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  createdAt: string;
  description?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  holdBalanceBefore?: number;
  holdBalanceAfter?: number;
  holdDelta?: number;
  gfdBalanceBefore?: number;
  gfdBalanceAfter?: number;
  gfdDelta?: number;
}








