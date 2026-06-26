import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './service/prisma.service';
import { LeaveRequestDto } from './dto/leave-request-dto';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    public prismaService: PrismaService,
  ) {}

  @Get('')
  async index(): Promise<object> {
    return {
      message: 'Company',
      data: await this.prismaService.company.findFirst(),
    };
  }

  @Get('/employee/:employeeId/leave-balance')
  getEmployeeLeaveBalance(@Param('employeeId') id: string): object {
    return this.prismaService.employee.findUnique({
      where: { id: +id },
      select: { annualLeaveBalance: true, firstname: true, lastname: true },
    });
  }

  @Get('/leave-requests')
  leaveRequests(
    @Query('employeeId') employeeId: any,
    @Query('status') status: any,
  ): object {
    return this.appService.fetchLeaveRequests(employeeId, status);
  }

  @Post('/leave-requests')
  newLeaveRequest(
    @Body(ValidationPipe) body: LeaveRequestDto,
    @Headers('X-Tenant-Id') tenantId: string,
  ): Promise<object> {
    return this.appService.newLeaveRequest(body, tenantId);
  }

  @Patch('/leave-requests/:id/approve')
  approveLeaveRequest(@Param('id') id: any): object {
    return this.appService.approveLeaveRequest(+id);
  }

  @Patch('/leave-requests/:id/reject')
  rejectLeaveRequest(): object {
    return {};
  }
}
