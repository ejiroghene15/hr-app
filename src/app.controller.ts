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

  @Get('/employees/:employeeId/leave-balance')
  getEmployeeLeaveBalance(@Param('employeeId') id: number): object {
    return this.prismaService.employee.findUnique({
      where: { id: id },
      select: { annualLeaveBalance: true, firstname: true, lastname: true },
    });
  }

  @Get('/leave-requests')
  leaveRequests(
    @Query('employeeId') employeeId: number,
    @Query('status') status: any,
  ): object {
    return this.appService.fetchLeaveRequests(employeeId, status);
  }

  @Post('/leave-requests')
  newLeaveRequest(
    @Body(ValidationPipe) body: LeaveRequestDto,
    @Headers('X-Tenant-Id')
    tenantId: string = 'dd783da3-531c-4f0d-9719-b4133f704237',
  ): Promise<object> {
    return this.appService.newLeaveRequest(body, tenantId);
  }

  @Patch('/leave-requests/:id/approve')
  approveLeaveRequest(@Param('id') id: string): object {
    return this.appService.approveLeaveRequest(+id);
  }

  @Patch('/leave-requests/:id/reject')
  rejectLeaveRequest(
    @Param('id') id: string,
    @Body('comment') comment: string,
  ): object {
    return this.appService.rejectLeaveRequest(+id, comment);
  }
}
