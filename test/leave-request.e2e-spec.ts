import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/service/prisma.service';

describe('Leave Request (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean up and create a test employee
    // Using $executeRawUnsafe as a workaround for dynamic import issues in some environments
    try {
      await prisma.$executeRawUnsafe('DELETE FROM leave_requests');
      await prisma.$executeRawUnsafe('DELETE FROM employee');
    } catch (e) {
      console.error('Cleanup failed, skipping...', e.message);
    }
    const employee = await prisma.employee.create({
      data: {
        firstname: 'Test',
        lastname: 'Employee',
        annualLeaveBalance: 10,
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
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        reason: 'Vacation'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
  });

  it('should fail if endDate is before startDate', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-07-05',
        endDate: '2026-07-04',
        reason: 'Vacation'
      });
    
    expect(res.status).toBe(400);
  });

  it('should fail if dates are in the past', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2020-01-01',
        endDate: '2020-01-02',
        reason: 'Past'
      });
    
    expect(res.status).toBe(400);
  });

  it('should fail if ANNUAL leave exceeds balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-08-01',
        endDate: '2026-08-15', // 15 days, balance is 10
        reason: 'Too long'
      });
    
    expect(res.status).toBe(400);
  });

  it('should fail if overlapping request exists', async () => {
    // First request
    await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        reason: 'First'
      });

    // Overlapping request
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'ANNUAL',
        startDate: '2026-09-03',
        endDate: '2026-09-10',
        reason: 'Overlap'
      });
    
    expect(res.status).toBe(400);
  });

  it('should require reason for SICK and UNPAID', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'SICK',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        reason: ''
      });
    expect(res1.status).toBe(400);

    const res2 = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'UNPAID',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        reason: ''
      });
    expect(res2.status).toBe(400);
  });

  it('should require reason length >= 20 for SICK > 3 days', async () => {
    const res = await request(app.getHttpServer())
      .post('/leave-requests')
      .send({
        employeeId: employeeId,
        leaveType: 'SICK',
        startDate: '2026-11-01',
        endDate: '2026-11-05', // 5 days
        reason: 'Too short'
      });
    expect(res.status).toBe(400);
  });
});
