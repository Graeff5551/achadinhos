# Security Specification

## Data Invariants
1. A user profile must match the authenticated UID.
2. A product can only be modified by the admin (`pauloverifica@gmail.com`).
3. An order must belong to the authenticated user.
4. Shipping is free for orders >= 100, otherwise it must be between 34 and 45 (validated at creation).

## The Dirty Dozen (Payloads expected to fail)
1. Creating a user profile with a different UID.
2. Updating someone else's user profile.
3. Creating a product as a non-admin.
4. Updating a product's price as a non-admin.
5. Deleting a product as a non-admin.
6. Reading orders that don't belong to you (as a non-admin).
7. Creating an order for a different userId.
8. Injecting a massive string into a product name.
9. Modifying the `createdAt` timestamp of a product.
10. Attempting to change an order's `total` after creation.
11. Setting yourself as admin in the user profile.
12. Listing all orders without being the admin or filtering by userId.

## Test Suite Plan
- Verify that non-admin writes to `/products` are DENIED.
- Verify that users can only read their own `/users/{uid}`.
- Verify that users can only read/write their own `/orders`.
- Verify admin access for `/products` and all `/orders`.
