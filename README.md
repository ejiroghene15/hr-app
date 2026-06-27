## Description

Multi-tenant application using NestJS

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

```

## Seed the database
```bash
$ npx prisma db seed
```

## Run tests

```bash
# e2e tests
$ npm run test:e2e
```



### SECTION 1

 - Who can approve leave? 
```aiignore
Anyone with administrative or managerial role, can approve leave
```
- Are approvers required to be managers
```aiignore
Yes, they must be managers
```
 - Are half-days supported or only full days
```aiignore
Only full days are supported
```
- Are half-days supported or only full days
```aiignore
Only full days are supported
```
-Do weekends and public holidays count against leave balance?
```aiignore
Yes, they do. I didn't factor in the clculation of weekend and public holidays not counting against the leave balance 
```
- How are dates stored and compared
```aiignore
Dates are converted to ISO strings and compared using the `new Date()` constructor
```
- What happens if two overlapping request are submitted at nearly the same time
```aiignore
In this scenario, idempotency is used to ensure that only one request is processed. With the neccessary checks and guards all put into place, subsequent requests are ignored.
```
- How i would enforce tenant isolation in production
```aiignore
I would enforce tenant isolation in production by using a database schema where the necessary tables hold the tenant_id as a foreign key to the tenant table. The tenant_id column would be what separates the data
```
