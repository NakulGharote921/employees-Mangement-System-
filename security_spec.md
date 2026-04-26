# Security Specification for Employee Pro

## Data Invariants
1. An employee record must have a valid department and position.
2. Only authenticated users can manage employee data.
3. Salary must be a positive number.
4. Leave requests must have a start date before the end date.
5. `createdBy` and `ownerId` (if applicable) fields are immutable.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create an employee with a different `createdBy` UID.
2. **Resource Poisoning**: Inject a 1MB string into the `firstName` field.
3. **State Shortcutting**: Approve a leave request directly without a manager ID.
4. **Invalid Type**: Send a boolean as a `salary`.
5. **Unauthorized Access**: Read the `employees` collection as an unauthenticated user.
6. **Shadow Update**: Add a `isVerified: true` field to an employee record.
7. **Negative Salary**: Create an employee with `-5000` salary.
8. **Invalid Date Range**: Start date after end date in a leave request.
9. **Email Spoofing**: Use an unverified email for an admin-only action.
10. **Query Scraping**: List all employees without filtering by status or department if restricted.
11. **ID Injection**: Use a special character ID `../root` to attempt path traversal.
12. **Orphaned Record**: Create an employee with a non-existent `departmentId`.

## Test Runner (firestore.rules.test.ts placeholder)
We will ensure rules reject these payloads.
