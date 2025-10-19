# Risk Assessment Matrix — Two Bit Foundry

**Purpose:**  
Identify, evaluate, and mitigate potential risks to systems and data handling Teller and Plaid financial information.

| Risk ID | Description | Likelihood | Impact | Mitigation | Owner | Review Date |
|----------|--------------|-------------|---------|-------------|--------|--------------|
| R-01 | AWS credentials exposed via repo | Medium | High | Enforce gitleaks + Secrets Manager only | DevOps Lead | YYYY-MM-DD |
| R-02 | Database breach | Low | High | AES-256 encryption, VPC isolation, MFA | CTO | YYYY-MM-DD |
| R-03 | Plaid/Teller outage | Medium | Medium | Graceful retries + cached data | Backend Lead | YYYY-MM-DD |
| R-04 | Unauthorized admin access | Low | High | IAM least-privilege + quarterly review | Security Lead | YYYY-MM-DD |
| R-05 | Data retention over policy limit | Medium | Low | Scheduled data purge + CloudWatch alerts | Backend Lead | YYYY-MM-DD |

**Process:**  
- Review quarterly or after any major system change.  
- Add new risks as products or integrations evolve.  
- Archive resolved risks in `/docs/compliance/archive/`.

**Acceptance Criteria:**  
Residual risk must be “Low” or justified by leadership.
