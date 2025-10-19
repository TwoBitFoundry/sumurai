# Change Management Policy — Two Bit Foundry

**Goal:**  
Ensure all production changes are reviewed, tested, and documented.

**Controls**
- All code changes occur through Pull Requests (PRs).  
- At least one peer review required before merge to `main`.  
- Automated CI/CD tests must pass prior to deployment.  
- Infrastructure changes tracked via Terraform or IaC PRs.  
- Emergency changes documented post-deployment with retro summary.

**Release Workflow**
1. Developer opens PR → triggers CI tests.  
2. Reviewer approves PR → auto-merge to staging.  
3. Staging deploy verified by QA or founder.  
4. Production deploy via CI/CD release job.  
5. Semantic-release tags version + updates CHANGELOG.

**Rollback Procedure**
- Each deployment tagged; rollback = redeploy prior tag.  
- Database migrations reversible or backed up before apply.

**Audit Evidence**
- GitHub PR history  
- CI/CD logs  
- Release tags & commit hashes

**Review Cycle:**  Every 6 months.
