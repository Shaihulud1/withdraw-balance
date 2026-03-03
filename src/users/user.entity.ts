import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { Transaction } from './transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @OneToMany('Transaction', (tx: any) => tx.user)
  transactions: Transaction[];
}
