#720 security: add security headers middleware (helmet.js) Repo Avatar
bakeronchain/learnvault Standard security headers (HSTS, CSP, X-Frame-Options,
etc.) may not all be set.\n\nAction:\n- [ ] Add helmet middleware to Express
app\n- [ ] Configure Content Security Policy for Stellar SDK and IPFS\n- [ ] Set
Strict-Transport-Security header\n- [ ] Set X-Content-Type-Options: nosniff\n- [
] Test headers with securityheaders.com\n- [ ] Ensure CSP does not break Stellar
wallet extensions

#709 devops: add secret scanning to prevent credential commits Repo Avatar
bakeronchain/learnvault Action:\n- [ ] Enable GitHub secret scanning on the
repository\n- [ ] Add gitleaks or truffleHog to pre-commit hooks\n- [ ] Scan
entire git history for existing leaked secrets\n- [ ] Document what to do if a
secret is accidentally committed\n- [ ] Rotate any secrets found

#708 devops: add database migration safety checks in CI Repo Avatar
bakeronchain/learnvault Action:\n- [ ] Run --dry-run migration check in CI
before deployment\n- [ ] Verify migrations are forward-only (no destructive
changes without explicit confirmation)\n- [ ] Check migration naming convention
consistency\n- [ ] Test migration rollback scripts exist\n- [ ] Alert if
migration takes more than N seconds (table lock risk)

#750 feat: add community events calendar (hackathons, study groups, workshops)
Repo Avatar bakeronchain/learnvault Action:\n- [ ] Add events table (title,
description, date, type, link)\n- [ ] Admin-created events\n- [ ] GET
/api/community/events endpoint\n- [ ] Calendar view on Community page\n- [ ]
Attendee RSVP / interest tracking\n- [ ] iCal export for personal calendar
integrationhttps://github.com/leojay-net/Stellar-Dex-Chat/https://github.com/leojay-net/Stellar-Dex-Chat/https://github.com/leojay-net/Stellar-Dex-Chat/https://github.com/leojay-net/Stellar-Dex-Chat/
