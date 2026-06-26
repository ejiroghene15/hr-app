import { getDays } from './utils';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from './service/prisma.service';
import { LeaveRequestDto, LeaveType } from './dto/leave-request-dto';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}
  async fetchLeaveRequests(employeeId: number, status: any): Promise<object> {
    const leaveRequests = await this.prisma.leaveRequests.findMany({
      where: {
        ...(employeeId && { employeeId: +employeeId }),
        ...(status && { status }),
      },
    });

    return { success: true, message: 'Leave Requests', data: leaveRequests };
  }
  async newLeaveRequest(dto: LeaveRequestDto, tenantId: any): Promise<object> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. endDate must be on or after startDate
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    // 2. Leave cannot be submitted for dates entirely in the past
    // The requirement says "entirely in the past", which means if it starts today or in the future it is fine.
    // If it ends before today, it is entirely in the past.
    if (endDate < today) {
      throw new BadRequestException(
        'Leave cannot be submitted for dates entirely in the past',
      );
    }

    // 3. reason is required for SICK and UNPAID
    if (
      (dto.leaveType === LeaveType.SICK ||
        dto.leaveType === LeaveType.UNPAID) &&
      !dto.reason
    ) {
      throw new BadRequestException(
        `reason is required for ${dto.leaveType} leave`,
      );
    }

    // 4. SICK leave for more than 3 consecutive days requires reason length of at least 20 characters
    const diffDays = getDays(startDate, endDate);

    if (dto.leaveType === LeaveType.SICK && diffDays > 3) {
      if (!dto.reason || dto.reason.length < 20) {
        throw new BadRequestException(
          'SICK leave for more than 3 consecutive days requires a properly stated reason of at least 20 characters',
        );
      }
    }

    // 5. Each employee has an annual leave balance in days
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // 6. Submitting ANNUAL leave must not exceed the remaining balance
    if (dto.leaveType === LeaveType.ANNUAL) {
      if (diffDays > employee.annualLeaveBalance) {
        throw new BadRequestException(
          `Annual leave exceeds remaining balance (${employee.annualLeaveBalance} days)`,
        );
      }
    }

    // 7. An employee cannot have overlapping PENDING or APPROVED leave requests for the same dates
    const overlappingRequest = await this.prisma.leaveRequests.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: dto.endDate },
            endDate: { gte: dto.startDate },
          },
        ],
      },
    });

    if (overlappingRequest) {
      throw new BadRequestException(
        'An employee cannot have overlapping PENDING or APPROVED leave requests for the same dates',
      );
    }

    // 8. On submission, request status must be PENDING (default in schema)
    const newRequest = await this.prisma.leaveRequests.create({
      data: {
        employeeId: dto.employeeId,
        tenantId,
        leaveType: dto.leaveType as any,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'Leave request submitted',
      data: newRequest,
    };
  }
  async approveLeaveRequest(id: number) {
    const request = await this.prisma.leaveRequests.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException('Leave request not found');

    if (request.status !== 'PENDING')
      throw new ConflictException('Leave request is not pending');

    // * UPDATE THE LEAVE REQUEST TO APPROVED
    const updateLeave = await this.prisma.leaveRequests.update({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });

    // * IF THE LEAVE TYPE IS ANNUAL, UPDATE THE EMPLOYEE'S ANNUAL LEAVE BALANCE
    if (request.leaveType === LeaveType.ANNUAL) {
      // * CALCULATE THE DAYS BASED ON START DATE AND END DATE OF THE REQUEST
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const diffDays = getDays(startDate, endDate);

      // * UPDATE THE ANNUAL LEAVE BALANCE FOR THE EMPLOYEE
      await this.prisma.employee.update({
        where: { id: request.employeeId },
        data: { annualLeaveBalance: { decrement: diffDays } },
      });
    }

    return {
      success: true,
      message: 'Leave request approved',
      data: updateLeave,
    };
  }
  async rejectLeaveRequest(id: number, comment: string) {
    if (!comment) {
      throw new BadRequestException('Comment is required');
    }

    try {
      const rejectAction = await this.prisma.leaveRequests.update({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', comment },
      });

      return {
        success: true,
        message: 'Leave request has been rejected',
        data: rejectAction,
      };
    } catch (error) {
      throw new PreconditionFailedException(
        'Leave request could not be rejected.',
      );
    }
  }
}
