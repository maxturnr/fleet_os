# QuickBooks Integration - Deployment Checklist

Complete checklist for deploying QuickBooks integration to production.

---

## Pre-Deployment

### Code Review
- [ ] All TypeScript files compile without errors
- [ ] Environment variables are properly configured
- [ ] No hardcoded credentials in code
- [ ] Error handling implemented for all API calls
- [ ] Logging configured for debugging

### Database
- [ ] Migration script tested in development
- [ ] Migration script run in production Supabase
- [ ] All indexes created
- [ ] RLS policies reviewed (currently disabled)
- [ ] Backup of existing data taken

### Storage
- [ ] `receipts` bucket created in Supabase
- [ ] Bucket configured as private
- [ ] MIME types configured (JPG, PNG, PDF)
- [ ] File size limit set (10MB)
- [ ] Storage policies reviewed

### QuickBooks Setup
- [ ] QuickBooks Developer account created
- [ ] App created in developer portal
- [ ] Client ID and Secret obtained
- [ ] Redirect URIs configured
- [ ] Scopes configured (accounting)
- [ ] Webhook verifier token generated

---

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

- [ ] All dependencies installed successfully
- [ ] No security vulnerabilities reported
- [ ] TypeScript compiles without errors

### 2. Environment Variables

#### Netlify Dashboard
- [ ] `SUPABASE_URL` set
- [ ] `SUPABASE_SERVICE_KEY` set
- [ ] `SUPABASE_ANON_KEY` set
- [ ] `QB_CLIENT_ID` set
- [ ] `QB_CLIENT_SECRET` set
- [ ] `QB_ENVIRONMENT` set to `production`
- [ ] `QB_WEBHOOK_TOKEN` set (secure random string)
- [ ] `URL` set to production domain

### 3. Deploy to Netlify

```bash
npm run deploy
```

- [ ] Build completed successfully
- [ ] Functions deployed
- [ ] Static files deployed
- [ ] No deployment errors

### 4. Verify Functions

Test each function endpoint:

#### OAuth Connect
```bash
curl https://your-domain.netlify.app/.netlify/functions/qb-connect?accountId=1
```
- [ ] Returns 302 redirect to QuickBooks
- [ ] State parameter included

#### Webhook
```bash
curl -X POST https://your-domain.netlify.app/.netlify/functions/qb-webhook \
  -H "Content-Type: application/json" \
  -d '{"eventNotifications":[]}'
```
- [ ] Returns 401 (invalid signature) - expected
- [ ] Function is accessible

#### Balance Sync
```bash
curl -X POST https://your-domain.netlify.app/.netlify/functions/qb-sync-balances \
  -H "Content-Type: application/json" \
  -d '{"accountId":1}'
```
- [ ] Returns error (no connection yet) - expected
- [ ] Function is accessible

### 5. Configure QuickBooks Webhook

In QuickBooks Developer Portal:

- [ ] Webhook URL added: `https://your-domain.netlify.app/.netlify/functions/qb-webhook`
- [ ] Webhook token entered (matches `QB_WEBHOOK_TOKEN`)
- [ ] Entities selected:
  - [ ] Purchase
  - [ ] Bill
  - [ ] Expense
  - [ ] Deposit
  - [ ] Payment
  - [ ] Invoice
  - [ ] SalesReceipt
- [ ] Webhook saved
- [ ] Test webhook sent successfully

### 6. Connect QuickBooks

- [ ] Open Fleet OS in browser
- [ ] Click "Connect QuickBooks" button
- [ ] Sign in to QuickBooks
- [ ] Grant permissions
- [ ] Redirected back to Fleet OS
- [ ] Connection status shows "Connected"
- [ ] Connection saved in database

---

## Testing

### End-to-End Test

#### 1. Create Test Transaction
- [ ] Log in to QuickBooks Online
- [ ] Create new Expense
- [ ] Fill in all required fields
- [ ] Save transaction

#### 2. Verify Webhook
- [ ] Wait 5-10 seconds
- [ ] Check Netlify function logs
- [ ] Verify webhook received
- [ ] Check `webhook_events` table
- [ ] Verify event processed

#### 3. Verify Transaction Import
- [ ] Check `transactions` table
- [ ] Verify transaction exists
- [ ] Verify all fields populated correctly
- [ ] Verify `status = 'unassigned'`
- [ ] Verify `source = 'quickbooks'`

#### 4. Verify Notification
- [ ] Check `notifications` table
- [ ] Verify notification created
- [ ] Verify notification shows in UI

#### 5. Assign Transaction
- [ ] Open unassigned transactions page
- [ ] Verify transaction appears
- [ ] Click "Assign" button
- [ ] Select vehicle
- [ ] Select category
- [ ] Add notes
- [ ] Upload receipt (optional)
- [ ] Click "Assign Transaction"
- [ ] Verify success message

#### 6. Verify Assignment
- [ ] Check `transactions` table
- [ ] Verify `status = 'assigned'`
- [ ] Verify `assigned_vehicle_id` set
- [ ] Verify `type` set
- [ ] Verify `notes` saved
- [ ] Verify `receipt_url` saved (if uploaded)

#### 7. Test Balance Sync
- [ ] Click "Sync Balances" button
- [ ] Wait for sync to complete
- [ ] Check `financial_accounts` table
- [ ] Verify accounts imported
- [ ] Verify balances correct
- [ ] Verify dashboard updated

---

## Post-Deployment

### Monitoring

- [ ] Set up Netlify function monitoring
- [ ] Set up Supabase monitoring
- [ ] Configure error alerts
- [ ] Set up uptime monitoring

### Documentation

- [ ] Update README with production URLs
- [ ] Document any custom configurations
- [ ] Create user guide for team
- [ ] Document troubleshooting steps

### User Training

- [ ] Train users on connecting QuickBooks
- [ ] Train users on assigning transactions
- [ ] Train users on uploading receipts
- [ ] Train users on syncing balances
- [ ] Provide support contact information

### Backup & Recovery

- [ ] Database backup configured
- [ ] Storage backup configured
- [ ] Recovery procedure documented
- [ ] Test restore procedure

---

## Security Checklist

### Credentials
- [ ] All secrets stored in environment variables
- [ ] No credentials in code or git
- [ ] Webhook token is strong and random
- [ ] Service role key kept secure
- [ ] Client secret kept secure

### Access Control
- [ ] Supabase RLS reviewed (consider enabling)
- [ ] Storage bucket is private
- [ ] Function endpoints secured
- [ ] User authentication required for UI

### Data Protection
- [ ] HTTPS enforced on all endpoints
- [ ] Webhook signature verification enabled
- [ ] Token refresh implemented
- [ ] Sensitive data encrypted at rest

### Compliance
- [ ] GDPR compliance reviewed (if applicable)
- [ ] Data retention policy defined
- [ ] Privacy policy updated
- [ ] Terms of service updated

---

## Rollback Plan

If issues occur:

### 1. Disable Webhook
- [ ] Go to QuickBooks Developer Portal
- [ ] Disable webhook
- [ ] Prevents new events from being sent

### 2. Revert Deployment
```bash
# Revert to previous Netlify deployment
netlify rollback
```
- [ ] Previous version restored
- [ ] Functions rolled back

### 3. Database Rollback
- [ ] Restore database from backup
- [ ] Or manually revert migration changes

### 4. Notify Users
- [ ] Inform users of temporary issues
- [ ] Provide ETA for resolution
- [ ] Document what went wrong

---

## Performance Optimization

### After Initial Deployment

- [ ] Monitor function execution times
- [ ] Optimize slow database queries
- [ ] Add database indexes if needed
- [ ] Implement caching where appropriate
- [ ] Monitor webhook processing times

### Scaling Considerations

- [ ] Monitor Netlify function usage
- [ ] Monitor Supabase database size
- [ ] Monitor storage usage
- [ ] Plan for increased transaction volume
- [ ] Consider implementing queue for webhooks

---

## Maintenance Schedule

### Daily
- [ ] Check Netlify function logs for errors
- [ ] Monitor webhook processing
- [ ] Check for unprocessed events

### Weekly
- [ ] Review transaction assignment rate
- [ ] Check for stuck transactions
- [ ] Monitor storage usage
- [ ] Review error logs

### Monthly
- [ ] Review QuickBooks token expiry
- [ ] Check for API rate limits
- [ ] Review database performance
- [ ] Update dependencies
- [ ] Security audit

### Quarterly
- [ ] Full system audit
- [ ] User feedback review
- [ ] Performance optimization
- [ ] Feature planning

---

## Success Metrics

Track these metrics post-deployment:

### Technical
- [ ] Webhook success rate > 99%
- [ ] Function execution time < 2s
- [ ] Zero data loss
- [ ] Zero security incidents

### User
- [ ] Transaction assignment rate > 90%
- [ ] Time to assign transaction < 2 minutes
- [ ] User satisfaction score > 4/5
- [ ] Support tickets < 5/week

### Business
- [ ] Reduction in manual data entry
- [ ] Improved financial visibility
- [ ] Faster month-end close
- [ ] Better P&L accuracy

---

## Support Contacts

### Technical Issues
- **Netlify**: https://answers.netlify.com/
- **Supabase**: https://supabase.com/support
- **QuickBooks**: https://help.developer.intuit.com/

### Internal
- **Developer**: [Your contact]
- **Admin**: [Admin contact]
- **Support**: [Support email]

---

## Sign-Off

### Deployment Team

- [ ] Developer sign-off: _________________ Date: _______
- [ ] QA sign-off: _________________ Date: _______
- [ ] Product owner sign-off: _________________ Date: _______

### Production Deployment

- [ ] Deployed by: _________________ Date: _______
- [ ] Verified by: _________________ Date: _______
- [ ] Approved by: _________________ Date: _______

---

**Deployment Date**: _______________  
**Version**: 3.0.0  
**Environment**: Production  
**Status**: ☐ Pending ☐ In Progress ☐ Complete
