# Security Policy — Two Bit Foundry

**Purpose:**  
Protect user and system data from unauthorized access, disclosure, or alteration.

**Scope:**  
All services, APIs, and infrastructure connected to Teller, Plaid, and our cloud environments.

**Core Controls**
- Data encrypted at rest (AES-256) and in transit (TLS 1.2+).  
- Secrets stored only in AWS Secrets Manager.  
- Infrastructure deployed through CI/CD with least-privilege IAM roles.  
- MFA required for all admin access.  
- Security events logged via CloudWatch / DataDog.

**Roles & Responsibilities**
| Role | Responsibility |
|------|----------------|
| Engineering | Implement & monitor security controls |
| Founders | Approve policies, own risk decisions |
| All Staff | Report incidents immediately |

**Review Cycle:** Every 6 months or after any major architecture change.
