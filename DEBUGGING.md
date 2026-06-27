### SECTION 2 – Debugging Exercise (Duplicate Leave Balance Deduction)

Incident:
An employee had 10 days annual leave balance. A 5-day annual leave request was
approved once, but the balance dropped to 0 instead of 5. Logs show the approval
handler ran twice within 200ms.

<div style="height: 200px; overflow-y: scroll">

```ts
async function approveLeaveRequest(requestId:string, approverId:string): Promise<div>
{
  const request = await this.db.leaveRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new NotFoundError('Leave request not found');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError('Leave request is not pending');
  }
  if (request.leaveType === 'ANNUAL') {
    const employee = await this.db.employee.findUnique({
      where: { id: request.employeeId },
    });
    if (employee.annualLeaveBalance < request.daysRequested) {
      throw new UnprocessableError('Insufficient leave balance');
    }
    await this.db.employee.update({
      where: { id: request.employeeId },
      data: {
        annualLeaveBalance:
          employee.annualLeaveBalance - request.daysRequested,
      },
    });
  }
  await this.db.leaveRequest.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      approvedBy: approverId,
      approvedAt: new Date(),
    },
  });
  await this.eventBus.publish('leave.approved', {
    requestId,
    employeeId: request.employeeId,
  });
  return request;
}
```

</div>

#### 1, What went Wrong
- The problem in the above code is tied to Race Condition. Both requests run simultaneously and pass the PENDING check before either updates the status which results in the balance being reduced twice.

#### 2, Balance Deduction
- Balance was deducted twice because the request wasn't isolated as a transaction. Both requests running simultaneously saw status = PENDING and updated the balance.

#### 3, Proposed Solution
- Wrap the update statements in a transaction which locks the rows for the duration of the transaction.
- The transaction is isolated, makes every other request wait until the transaction is complete.
- Implement atomic update for balance deduction.
- Add condition to update status only if the request status is PENDING.

<div style="height: 200px; overflow-y: scroll">

```ts
async function approveLeaveRequest(requestId: string, approverId: string) {
  return this.db.$transaction(async (tx) => {

    // 1. Fetch the leave request
    const request = await tx.leaveRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) throw new NotFoundError("Leave request not found");

    if (request.status !== "PENDING") {
      throw new ConflictError("Leave request is not pending");
    }

    // 2. check balance BEFORE touching anything
    if (request.leaveType === "ANNUAL") {
      const employee = await tx.employee.findUnique({
        where: { id: request.employeeId }
      });

      if (employee.annualLeaveBalance < request.daysRequested) {
        throw new UnprocessableError("Insufficient leave balance");
      }
    }

    // 3. gate on status — blocks concurrent requests
    await tx.leaveRequest.update({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        approvedBy: approverId,
        approvedAt: new Date()
      }
    });

    // 4. Safe to deduct now - atomic balance deduction — no read-then-write. The db handles it
    if (request.leaveType === "ANNUAL") {
      await tx.employee.update({
        where: { id: request.employeeId },
        data: {
          annualLeaveBalance: { decrement: request.daysRequested } // atomic — DB handles it
        }
      });
    }
  });

  // 4. publish event OUTSIDE the transaction
  await this.eventBus.publish("leave.approved", {
    requestId,
    employeeId: request.employeeId
  });
}
```

</div>
<br>

#### 4, Why this works
- Transaction ensures all-or-nothing execution
- The transaction locks the rows until the process is complete.
- Atomic status gate blocks subsequent requests.
 
So, if an error is thrown at any point;
- The status update is rolled back
- The balance deduction is rolled back
- The database is left in exactly the state it was before the request started


#### 5, To prevent recurrence, 
- I would implement an idempotency check by sending a unique key, used to check if the request has already been processed. 