-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "employee" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annual_leave_balance" INTEGER NOT NULL DEFAULT 365,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "reason" TEXT,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
