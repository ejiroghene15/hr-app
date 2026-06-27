import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './service/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            company: {
              findFirst: jest.fn().mockResolvedValue({ name: 'Test Company' }),
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    prismaService = app.get<PrismaService>(PrismaService);
  });

  describe('root', () => {
    it('should return company info', async () => {
      const result = await appController.index();
      expect(result).toEqual({
        message: 'Company',
        data: { name: 'Test Company' },
      });
    });
  });
});
