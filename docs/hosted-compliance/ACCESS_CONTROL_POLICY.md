# Access Control Policy — Two Bit Foundry

**Goal:**  
Ensure only authorized personnel can access production or user data.

**Standards**
- MFA required for AWS, GitHub, and admin tools.  
- No shared accounts; unique identities only.  
- Access follows least-privilege and role-based models.  
- Access reviewed quarterly and upon role change.  
- Teller/Plaid tokens scoped per user and encrypted at rest.

**Enforcement**
- Violations result in immediate credential revocation.  
- Logs retained 90 days for audits.
