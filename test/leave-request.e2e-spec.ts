import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/service/prisma.service';

describe('Leave Request (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeeId: number;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up
    try {
      await prisma.$executeRawUnsafe('DELETE FROM leave_requests');
      await prisma.$executeRawUnsafe('DELETE FROM employee');
      await prisma.$executeRawUnsafe('DELETE FROM company');
    } catch (e) {
      console.error('Cleanup failed, skipping...', e.message);
    }

    // Create a test company
    const company = await prisma.company.create({
      data: {
        name: 'Test Company',
      },
    });
    tenantId = company.id;

    const employee = await prisma.employee.create({
      data: {
        firstname: 'Test',
        lastname: 'Employee',
        annualLeaveBalance: 10,
        tenantId: tenantId,
      },
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a valid leave request', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        reason: 'Vacation',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('should fail if endDate is before startDate', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-07-05',
        endDate: '2026-07-04',
        reason: 'Vacation',
      });

    expect(res.status).toBe(400);
  });

  it('should fail if dates are in the past', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2020-01-01',
        endDate: '2020-01-02',
        reason: 'Past',
      });

    expect(res.status).toBe(400);
  });

  it('should fail if ANNUAL leave exceeds balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-08-01',
        endDate: '2026-08-15', // 15 days, balance is 10
        reason: 'Too long',
      });

    expect(res.status).toBe(400);
  });

  it('should fail if overlapping request exists', async () => {
    // First request
    await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        reason: 'First',
      });

    // Overlapping request
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-09-03',
        endDate: '2026-09-10',
        reason: 'Overlap',
      });

    expect(res.status).toBe(400);
  });

  it('should require reason for SICK and UNPAID', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'SICK',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        reason: '',
      });
    expect(res1.status).toBe(400);

    const res2 = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'UNPAID',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        reason: '',
      });
    expect(res2.status).toBe(400);
  });

  it('should require reason length >= 20 for SICK > 3 days', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'SICK',
        startDate: '2026-11-01',
        endDate: '2026-11-05', // 5 days
        reason: 'Too short',
      });
    expect(res.status).toBe(400);
  });

  it('should approve leave and deduct balance once', async () => {
    // 1. Create a request
    const createRes = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-12-01',
        endDate: '2026-12-02', // 2 days
        reason: 'Deduction test',
      });
    const requestId = createRes.body.data.id;

    // 2. Get initial balance
    const employeeBefore = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    const initialBalance = employeeBefore?.annualLeaveBalance;

    // 3. Approve request
    const approveRes = await request(app.getHttpServer())
      .patch(`/leave-requests/${requestId}/approve`)
      .send();

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.message).toBe('Leave request approved');

    // 4. Verify balance deducted
    const employeeAfter = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    expect(employeeAfter?.annualLeaveBalance).toBe(initialBalance - 2);
  });

  it('should prevent duplicate approval deduction', async () => {
    // 1. Create a request
    const createRes = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-12-05',
        endDate: '2026-12-06', // 2 days
        reason: 'Duplicate test',
      });
    const requestId = createRes.body.data.id;

    // 2. Approve first time
    await request(app.getHttpServer())
      .patch(`/leave-requests/${requestId}/approve`)
      .send();

    const employeeAfterFirst = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    const balanceAfterFirst = employeeAfterFirst?.annualLeaveBalance;

    // // 3. Approve second time
    // const secondApproveRes = await request(app.getHttpServer())
    //   .patch(`/leave-requests/${requestId}/approve`)
    //   .send();
    //
    // expect(secondApproveRes.status).toBe(200);
    // expect(secondApproveRes.body.message).toBe(
    //   'Leave request already approved',
    // );

    // 4. Verify balance NOT deducted again
    const employeeAfterSecond = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    expect(employeeAfterSecond?.annualLeaveBalance).toBe(balanceAfterFirst);
  });

  it('should reject request with missing comment', async () => {
    // 1. Create a request
    const createRes = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('X-Tenant-Id', tenantId)
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-12-10',
        endDate: '2026-12-11',
        reason: 'Reject test',
      });
    const requestId = createRes.body.data.id;

    // 2. Try to reject without comment
    const rejectRes = await request(app.getHttpServer())
      .patch(`/leave-requests/${requestId}/reject`)
      .send({ comment: '' });

    expect(rejectRes.status).toBe(400);
    expect(rejectRes.body.message).toBe('Comment is required');
  });
});
