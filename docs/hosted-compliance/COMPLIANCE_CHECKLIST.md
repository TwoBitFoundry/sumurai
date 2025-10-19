# Compliance Checklist — Two Bit Foundry

| Area | Control | Status | Evidence |
|------|----------|--------|-----------|
| Encryption | AES-256 at rest, TLS 1.2+ | ✅ | AWS KMS screenshots |
| Secrets Mgmt | Stored in Secrets Manager | ✅ | Console config |
| MFA | Enforced for admin accounts | ✅ | Okta / AWS IAM |
| Backups | Daily + tested | ✅ | S3 Lifecycle logs |
| Logging | Centralized + retained 90 days | ✅ | CloudWatch |
| Access Reviews | Quarterly | 🕒 | Audit record |
| Privacy | “Delete my data” endpoint live | ✅ | API docs |
| Vendor Review | Annual | 🕒 | Vendor table updated |

**Last Review:** _(fill date)_  
**Next Review:** _(fill date)_  
**Owner:** Security Lead / Founder
