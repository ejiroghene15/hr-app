import {Body, Controller, Get, Post} from '@nestjs/common';
import {AppService} from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @Get('/employees/:employeeId/leave-balance')
    getEmployeeLeaveBalance(): string {
        return this.appService.getHello();
    }

    @Get('/leave-requests')
    leaveRequests(): object {
        return [{}]
    }

    @Post('/leave-requests')
    newLeaveRequest(@Body() body: object): object {
        return {}
    }


    @Post('/leave-requests/:id/reject')
    rejectLeaveRequest(): object {
        return {}
    }

    @Post('/leave-requests/:id/approve')
    approveLeaveRequest(): object {
        return {}
    }
}
