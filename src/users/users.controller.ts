import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { WithdrawDto } from './dto/withdraw.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/balance')
  async getBalance(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getBalance(id);
  }

  @Post(':id/withdraw')
  async withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() withdrawDto: WithdrawDto,
  ) {
    return this.usersService.withdraw(id, withdrawDto);
  }
}
