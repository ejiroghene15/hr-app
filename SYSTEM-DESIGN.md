### SECTION 3 – System Design

#### Scaling Leave Submission

```text
- I would use a queue service to handle the load and process the request in the background
- I would implement rate limit mechanism to throttle the requests
```

#### Duplicate Event Processing
```text
I would save processed events in a Database
- Create a unique id for each event sent to the queue 
- Check if the event exists in the database before processing it.
- If the event exists, ignore it.
- If the event does not exist, process it and save it to the database.
```

#### Audit Logging
```text
- I would implement a log feature that can be used inside the approve/reject API methods in a synchronous manner.
```

#### Sync Vs Async Balance Deduction
```text
I would choose balance deduction done synchronously inside the approve API as;
this ensure balance accuracy as the process is carried out within a transaction.
```
##### The Tradeoff Summary

| Concern | Sync | Async |
|---------|------|-------|
| Balance accuracy | Immediate ✅ | Eventually consistent ⚠️ |
| API response time | Slightly slower | Faster |
| Failure handling | Atomic rollback ✅ | Requires retry + idempotency |
| Complexity | Low ✅ | Higher |
| Debuggability | Simple ✅ | Harder to trace |

---


#### Monolith vs Microservice
```text
I would keep leave management inside the main HR application as it is a core feature of the HR application.
I would split it into a separate leave service when the HR application becomes too large and the leave management becomes too complex.
```

<br> 

### SECTION 4 – Product Engineering

#### Scenario B - Consistency Vs Performance
Finance wants real-time leave balance on every page load.
The database query adds 80ms per request.
Caching balance in Redis gives 5ms reads but can be stale for up to 60 seconds after
approval

##### 1, Tradeoff

| Feature | Database | Redis |
|---------|----------|-------|
| Read Speed | Slower (80ms) | 16x faster (5ms) |
| Accuracy | Always accurate ✅ | Stale cache (up to 60s) ⚠️ |
| Complexity | Simple (No caching logic) | Requires cache invalidation logic |
| Truth Source | One source of truth ✅ | Derived / Cached |
| Cost | Higher resource usage | Cheap to implement ✅ |

#### 2, Which approach would you recommend for an HR/payroll-adjacent product? How would you mitigate the downside of your chosen approach 
I would recommend using Redis for caching for a longer time and invalidating the cache when the balance is updated.
This approach would ensure that the balance is always accurate and up-to-date. In this situation, the only time when balance is stale is when the leave request is approved for an employee
 
#### Scenario C – Conflicting Requirements
Legal says sick leave records must be retained for 7 years.
Engineering wants to hard-delete employee PII on account deletion for privacy
compliance.
Both are non-negotiable

- 1 How would you reconcile these requirements?
```text
Anonymisation - I would decouple the record from the identity, by using a soft-delete flag to mark records as deleted.
```
- 2 What would your data model or retention strategy look like at a high level?

```html
Before deletion                     After deletion
──────────────────────────────      ──────────────────────────────
employeeId:    42                   employeeId:    42 (retained)
name:          Jiro Ade             name:          [deleted]
email:         jiro@company.com     email:         [deleted]
phone:         +234 801 234 5678    phone:         [deleted]
leaveRecords:  [sick, 5 days...]    leaveRecords:  [sick, 5 days...] (retained)
```

Employee table — soft delete with anonymisation
```prisma
model Employee {
  id              Int       @id @default(autoincrement())
  tenantId        String

  // PII — wiped on account deletion
  firstName       String?   // nullable so it can be cleared
  lastName        String?
  email           String?
  phone           String?
  nationalId      String?

  // non-PII — retained
  employeeNumber  String    // internal reference, not personally identifying
  department      String?
  jobTitle        String?

  // deletion tracking
  deletedAt       DateTime? // when account was deleted
  anonymisedAt    DateTime? // when PII was wiped
  retentionExpiry DateTime? // when leave records can be fully purged (deletedAt + 7 years)

  leaveRequests   LeaveRequest[]
}
```

Leave record — references employee by ID only
```prisma
model LeaveRequest {
  id           Int          @id @default(autoincrement())
  tenantId     String
  employeeId   Int          // FK to Employee — retained even after anonymisation
  leaveType    LeaveType
  startDate    DateTime     @db.Date
  endDate      DateTime     @db.Date
  daysRequested Int
  status       LeaveStatus
  createdAt    DateTime     @default(now())

  employee     Employee     @relation(fields: [employeeId], references: [id])
}
```


