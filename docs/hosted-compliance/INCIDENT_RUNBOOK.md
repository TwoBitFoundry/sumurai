# Security Incident Runbook — Two Bit Foundry

**Purpose:**  
Provide a repeatable process for responding to security events.

---

## 1️⃣ Detection
- Alerts from DataDog / AWS GuardDuty / user reports.
- Log anomalies, suspicious API spikes, or 4xx/5xx surges.

## 2️⃣ Initial Triage
- Determine severity:  
  - **Critical:** potential data exposure or system compromise  
  - **High:** elevated permissions abuse or service downtime  
  - **Medium:** failed login brute-force, temporary access issue  
- Notify: `security@twobitfoundry.com` + founders immediately.

## 3️⃣ Containment
- Disable affected credentials or IAM roles.  
- Revoke Teller/Plaid tokens if necessary.  
- Block offending IPs at WAF/firewall level.

## 4️⃣ Eradication
- Patch vulnerability, rotate keys, redeploy clean build.  
- Validate no residual malicious processes remain.

## 5️⃣ Recovery
- Restore data from latest clean backup.  
- Verify services operational.  
- Continue enhanced monitoring for 7 days.

## 6️⃣ Post-Mortem
- Document timeline, cause, and mitigation steps.  
- Update policies or automation gaps identified.  
- Share summary internally; update `/docs/compliance/incidents/`.

**Response SLA:**  
- Triage within 1 hour.  
- Containment within 4 hours.  
- User notification (if breach confirmed) within 72 hours.
