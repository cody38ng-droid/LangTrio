# Security Specification for Lang Trio

## Data Invariants
1. A user can only modify their own profile document.
2. A user can create a score entry but cannot modify or delete it once submitted.
3. Scores must be associated with the authenticated user ID.
4. User names and scores must have strict size limits to prevent resource exhaustion.
5. Leaderboard reads are public but limited to the specific fields needed.

## The Dirty Dozen Payloads
1. **The Identity Thief**: User A trying to update User B's profile.
2. **The XP Inflator**: User A self-incrementing totalXp by 1,000,000 in a single write.
3. **The Shadow Field**: User A adding `isAdmin: true` to their profile.
4. **The Ghost Entry**: Creating a score for a userId that doesn't match the auth.uid.
5. **The Time Traveler**: Submitting a score with a timestamp from 2030.
6. **The Payload Bomber**: Sending a 1MB string as a displayName.
7. **The Retroactive Edit**: Trying to update an existing result in the `scores` collection.
8. **The Delete Attack**: Attempting to clear the global `scores` leaderboard.
9. **The ID Poisoner**: Creating a user document with a 2KB junk string as the ID.
10. **The Anonymous Write**: Unauthenticated user trying to submit a score.
11. **The Spoofed Email**: Using a non-verified email to claim admin rights (if admin existed).
12. **The Spam Bot**: Creating 100 score entries in 1 second (handled by rate limiting/rules).

## Test Runner
(Standard `firestore.rules.test.ts` logic will follow in the next step to verify these constraints).
