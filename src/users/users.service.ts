import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User } from './user.entity';
import { Transaction, ActionType } from './transaction.entity';
import { WithdrawDto } from './dto/withdraw.dto';
import { userBalanceCacheKey } from './utils';

const BALANCE_CACHE_TTL = 60000;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findOneOrError(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getBalance(id: number): Promise<{ balance: number }> {
    const cacheKey = userBalanceCacheKey(id);
    const cachedBalance = await this.cacheManager.get<number>(cacheKey);
    
    if (cachedBalance !== undefined && cachedBalance !== null) {
      return { balance: Number(cachedBalance) };
    }

    const user = await this.findOneOrError(id);
    const balance = Number(user.balance);
    await this.cacheManager.set(cacheKey, balance, BALANCE_CACHE_TTL);
    
    return { balance };
  }

  async withdraw(userId: number, withdrawDto: WithdrawDto): Promise<User> {
    const { amount } = withdrawDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager
        .getRepository(User)
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');

      if (user.balance < amount) {
        throw new BadRequestException('Insufficient funds');
      }

      const transaction = queryRunner.manager.getRepository(Transaction).create({
        action: ActionType.WITHDRAW,
        amount: -amount, // Храним отрицательное значение для списаний
        userId: user.id,
      });
      await queryRunner.manager.save(transaction);

      const { balance } = await queryRunner.manager
        .createQueryBuilder()
        .select('COALESCE(SUM(amount), 0)', 'balance')
        .from(Transaction, 'tx')
        .where('tx.userId = :userId', { userId })
        .getRawOne();

      user.balance = Number(balance);
      await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      await this.cacheManager.del(userBalanceCacheKey(userId));
      return user;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
