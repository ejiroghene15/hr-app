import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  UNPAID = 'UNPAID',
}

export class LeaveRequestDto {
  @IsInt()
  employeeId: number;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
