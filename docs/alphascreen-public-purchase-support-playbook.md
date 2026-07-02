# alphaScreen Public Purchase Support Playbook

alphaScreen by alphaSource - internal support guide

Audience: alphaSource admin and support users who help buyers complete self-serve alphaScreen membership purchases.

Use this guide when a buyer has started public signup, signed or needs to sign a membership agreement, completed or needs to complete Stripe Checkout, or needs help reaching account setup.

## Support standard

> Every purchase row should be triaged from Admin Public Purchases. Do not manually mark agreements, payments, billing, or account activation outside an approved escalation.

Admin Public Purchases is the support source of truth for self-serve alphaScreen memberships. The page combines purchase intent, membership agreement, checkout, account setup, and email delivery signals so support can see where the buyer is stuck without using raw webhook payloads or private system data.

Do not use spreadsheets, inbox notes, or memory as the daily source of truth for purchase status. Use Admin Public Purchases, copy the support summary when escalating, and keep support notes sanitized.

## How a public purchase moves through alphaScreen

Pricing page > Membership signup > Purchase intent > Membership agreement > Stripe Checkout > Webhook activation > Client and member setup > Password setup > Dashboard access

The buyer starts from the public alphaScreen pricing experience, chooses a Basic or Pro membership and billing cadence, enters buyer and company details, signs the membership agreement, completes secure Stripe Checkout, then sets a password before entering the dashboard.

Support should help the buyer resume the current step. Support should not skip agreement signing, bypass Stripe Checkout, override webhook activation, or create billing state manually.

## Table of contents

1. Overview
2. Public purchase lifecycle
3. Admin Public Purchases page
4. Screenshot slots
5. Agreement pending
6. Signed but unpaid or checkout pending
7. Did not return from Stripe
8. Paid but setup pending
9. Existing user purchase
10. Welcome email not received
11. Setup email not received
12. Wrong buyer email
13. Duplicate purchase attempt
14. Cancellation, refund, or membership change request
15. Email delivery issue
16. Webhook or payment mismatch
17. Escalation rules
18. Safe support language snippets
19. Glossary
20. Production use note

## 1. Overview

Admin and support users are responsible for helping buyers understand the purchase step they are in and safely resend the correct recovery email or link when the system allows it.

Use Admin Public Purchases to answer four questions:

1. Did the buyer start signup?
2. Has the membership agreement been sent, opened, and signed?
3. Has Stripe Checkout been started and paid?
4. Has the client/member account been created and linked?

Never tell a buyer that payment, access, or cancellation is complete unless the Admin Public Purchases row shows a completed state or engineering/admin billing support has confirmed it.

## 2. Public purchase lifecycle

Active work moves left to right. Agreement signing is the gate before checkout. Stripe payment confirmation is the gate before account setup and dashboard access.

### Standard lifecycle

1. Buyer starts membership signup from the public pricing page.
2. alphaScreen creates a purchase intent with buyer, company, membership, cadence, and source path details.
3. The membership agreement is generated and sent to the buyer email on the purchase row.
4. Buyer signs the agreement.
5. Buyer continues to secure Stripe Checkout.
6. Stripe confirms checkout through the webhook.
7. alphaScreen activates the client account and member access.
8. If the buyer selected first-role prepay, alphaScreen creates one unused first-role credit under the billing client.
9. Buyer receives password setup and welcome emails when applicable.
10. Buyer sets a password and enters the alphaScreen dashboard.

### Operating principle

Help the buyer resume the next safe step. Do not advance records by hand to make the row look complete.

## 3. Admin Public Purchases page

Use the admin page for self-serve purchase review and recovery. The page is admin-only and should not be sent directly to customers.

### What the page shows

- Buyer and company details, including buyer name, email, phone, and title when available.
- Membership and cadence, including Basic or Pro membership, monthly or annual cadence, platform fee, per-role fee, included interviews, duration cap, and additional interview price when available.
- First-role prepay state when available: not selected, selected with unused credit, or selected with used role id and used time.
- Source path showing where the buyer started the purchase.
- Agreement status, sent/opened/signed timing, and checkout status tied to the agreement.
- Checkout session and Stripe indicators for internal review.
- Client/member setup state, including whether the client exists and whether the buyer member is linked to a user.
- Welcome and setup email delivery state when recorded.
- Support summary for sanitized internal escalation.

### Summary cards and filters

Use the summary cards for triage:

- Started: new signup submissions in the selected date range.
- Agreement pending: agreement has not been signed yet.
- Signed / checkout: agreement is signed but payment is unpaid or checkout is in progress.
- Setup pending: payment appears complete, but setup or member linking is still in progress.
- Completed: active billing and linked member access are present.
- Failed / canceled: payment failed, purchase expired, or purchase was canceled.
- Unknown: records that do not map cleanly to a known state.

Filters are available for date range, status, membership, cadence, and company or buyer email search.

### Row actions

Open a purchase row with Details before taking action. Available recovery actions depend on the row status.

- Resend agreement link: use only when the buyer needs to sign or reopen the agreement.
- Resend checkout link: use only after agreement signing when payment is not complete.
- Resend setup email: use when payment is complete but password setup is missing or not received.
- Resend welcome email: use when the client/member setup exists and the welcome email needs recovery.
- Copy support summary: use for sanitized internal escalation notes.

Email sends are admin-only. They do not change payment, billing, agreement, or access status.

### What the page cannot do

- It cannot mark an agreement signed.
- It cannot mark a checkout paid.
- It cannot activate billing manually.
- It cannot edit Stripe subscriptions.
- It cannot manually apply, move, or alter first-role credit records.
- It cannot delete, void, cancel, or refund a public purchase.
- It cannot override customer, client, or member state without escalation.

### Standing rule

If the row is not clearly complete, describe the current state and next step. Do not promise activation, refund, cancellation, or billing changes without confirmation.

## 4. Screenshot slots

Add screenshots after the QA or production admin view is stable. Use sanitized records only. Redact customer names, emails, phone numbers, Stripe identifiers, agreement identifiers, and any private notes before sharing outside alphaSource.

- Screenshot slot: Admin Public Purchases overview.
- Screenshot slot: Expanded row details.
- Screenshot slot: Recovery actions.
- Screenshot slot: Agreement-pending row.
- Screenshot slot: Completed or setup-pending row.
- Screenshot slot: Canceled row.
- Screenshot slot: Public pricing/signup page, if useful for support orientation.

## 5. Agreement pending

### Symptoms

- Status is Agreement pending.
- Agreement status shows sent, opened, pending signature, or similar.
- Checkout is not paid.
- Buyer says they did not receive the agreement or cannot find the signing link.

### Support action

1. Open Admin Public Purchases.
2. Search by buyer email or company name.
3. Expand the row and confirm the buyer email.
4. Confirm the row is agreement pending and checkout is not paid.
5. Use Resend agreement link if available.
6. Ask the buyer to check their inbox and spam folder for the new agreement email.
7. Refresh the row after the buyer signs.

### Do not

- Do not send checkout instructions before the agreement is signed.
- Do not paste signing URLs into support notes.
- Do not mark the agreement signed manually.

### Suggested wording

> I found your alphaScreen membership signup. The agreement still needs to be completed before secure checkout can open. I resent the agreement email to the buyer address on file. Please use the newest email and let us know if it does not arrive.

### Escalate when

- The buyer email is wrong.
- Resend agreement link is unavailable when the row appears eligible.
- The buyer signed but the row still shows agreement pending after refresh.

## 6. Signed but unpaid or checkout pending

### Symptoms

- Status is Signed / unpaid or Checkout pending.
- Agreement signed time is present.
- Payment status is unpaid, incomplete, pending, failed, or not clearly paid.
- Buyer says they signed but has not completed payment.

### Support action

1. Confirm the row has a signed agreement.
2. Confirm payment is not shown as paid or completed.
3. Use Resend checkout link if available.
4. Tell the buyer to complete secure checkout from the new email.
5. Refresh after the buyer completes checkout.

### Do not

- Do not tell the buyer their membership is active until payment and setup are complete.
- Do not manually create a Stripe subscription.
- Do not change the checkout session or billing cadence in Stripe without escalation approval.

### Suggested wording

> Your alphaScreen agreement appears to be signed, and the next step is secure checkout. I resent the checkout recovery email to the buyer address on file. Once checkout is completed, account setup should continue automatically.

### Escalate when

- Stripe shows payment complete but the admin row still shows unpaid.
- The checkout link action is unavailable for a signed unpaid row.
- Buyer reports a payment failure that is not visible in the row.

## 7. Did not return from Stripe

### Symptoms

- Buyer says payment was completed but they did not return to alphaScreen.
- Buyer closed the browser after checkout.
- Buyer is unsure whether payment succeeded.
- Admin row may be checkout pending, setup pending, completed, or unknown.

### Support action

1. Search Admin Public Purchases by buyer email.
2. Refresh the page and inspect the row status.
3. If completed, guide the buyer to login or password setup.
4. If setup pending, resend setup email if available.
5. If checkout pending, wait briefly and refresh before escalating.
6. If payment signals conflict, copy the support summary and escalate.

### Do not

- Do not ask the buyer to pay again unless the row and billing review confirm the first checkout did not complete.
- Do not rely on the buyer's browser return state alone.
- Do not paste Stripe session identifiers into customer-facing replies.

### Suggested wording

> Secure checkout can take a few minutes to confirm. I am checking the purchase status from our admin view. If payment has completed, we will help you continue setup. If the payment status is still unclear, we will review it before asking you to take another payment step.

## 8. Paid but setup pending

### Symptoms

- Status is Setup pending.
- Payment appears complete.
- Client/member setup is not fully linked.
- Buyer cannot access the dashboard or did not receive password setup.

### Support action

1. Expand the row and confirm payment appears complete.
2. Check member setup and email delivery state.
3. Use Resend setup email if available.
4. Use Resend welcome email only if the account/member setup exists and the row allows it.
5. Ask the buyer to use the newest setup email.
6. Escalate if the row stays setup pending after refresh and resend.

### Do not

- Do not create a user manually from the admin page.
- Do not send password setup tokens in support notes.
- Do not tell the buyer they have access until setup is linked.

### Suggested wording

> Your payment appears to be complete, and the remaining step is account setup. I resent the password setup email to the buyer address on file. Please use the newest email to finish creating access.

## 9. Existing user purchase

### Symptoms

- Buyer already has an alphaScreen or alphaSource login.
- Payment completed but buyer expects a new setup email.
- Member setup may show linked user access.

### Support action

1. Confirm the row status and member user linking.
2. If the member is linked, direct the buyer to login with their existing account.
3. Resend welcome email only if available and appropriate.
4. Escalate if the buyer cannot access the expected client or entity after login.

### Do not

- Do not create a duplicate user.
- Do not reset access manually without confirming the linked member state.
- Do not expose internal user IDs in support replies.

### Suggested wording

> This purchase appears tied to an existing alphaScreen login. Please sign in with your existing account first. If the new membership is not visible after login, reply here and we will review the account link.

## 10. Welcome email not received

### Symptoms

- Buyer completed payment and setup.
- Welcome email delivery is missing, failed, or not received.
- Dashboard access may already work.

### Support action

1. Confirm the row is completed or setup exists.
2. Check welcome email status in row details.
3. Use Resend welcome email if available.
4. Ask the buyer to check spam and filtered inboxes.
5. Escalate if SendGrid delivery is missing or repeatedly fails.

### Do not

- Do not make the welcome email a blocker if account access already works.
- Do not paste raw email provider payloads into notes.
- Do not resend repeatedly without waiting for delivery state to update.

### Suggested wording

> I resent the alphaScreen welcome email to the buyer address on file. You can still sign in if your password setup is complete. Please check spam or filtering rules if the welcome email does not arrive.

## 11. Setup email not received

### Symptoms

- Payment appears complete.
- Buyer cannot set a password.
- Setup email status is missing or buyer did not receive it.

### Support action

1. Confirm payment appears complete.
2. Confirm setup is still pending or member linking is incomplete.
3. Use Resend setup email if available.
4. Tell the buyer to use the newest setup email.
5. Escalate if the setup email still does not arrive or member linking does not update.

### Do not

- Do not share setup tokens, password reset tokens, or generated links in support notes.
- Do not manually mark setup complete.
- Do not ask the buyer to start a second purchase to solve setup email delivery.

### Suggested wording

> I resent the password setup email to the buyer address on file. Please use the newest email to finish account setup. If it does not arrive, we will escalate the email delivery check.

## 12. Wrong buyer email

### Symptoms

- Buyer entered the wrong email.
- Agreement or checkout link went to the wrong address.
- Buyer wants support to forward a link to a different address.

### Support action

1. Confirm whether agreement is unsigned, signed, paid, or completed.
2. If unsigned and unpaid, recommend restarting signup with the correct buyer email unless an approved admin path exists.
3. If signed or paid, copy the support summary and escalate before changing anything.
4. Use only sanitized notes in the escalation.

### Do not

- Do not forward agreement, checkout, or setup links to a different email.
- Do not paste signing URLs or setup links into support replies.
- Do not edit buyer identity or payment records without escalation approval.

### Suggested wording

> The buyer email on the signup controls agreement, checkout, and setup delivery. Because the address appears incorrect, we need to review the safest correction path before sending any account or payment links to a different email.

## 13. Duplicate purchase attempt

### Symptoms

- Multiple rows appear for the same company or buyer.
- Buyer started signup more than once.
- One row may be agreement pending while another is signed, paid, or completed.

### Support action

1. Search by buyer email and company name.
2. Compare status, created time, membership, cadence, and payment indicators.
3. Continue support from the most advanced legitimate row.
4. If any row appears paid or duplicate-billed, escalate before giving payment instructions.
5. If all rows are unsigned and unpaid, tell the buyer to use the newest intended signup path.

### Do not

- Do not delete duplicate records.
- Do not ask the buyer to pay again while any matching row may already be paid.
- Do not cancel, void, or refund from the admin page.

### Suggested wording

> I see more than one signup attempt, so I am checking which one is the active path before sending another payment or setup instruction. We will use the safest current record and avoid duplicate checkout steps.

## 14. Cancellation, refund, or membership change request

### Symptoms

- Buyer asks to cancel before payment.
- Buyer asks for refund after payment.
- Buyer wants to change membership, cadence, company, or billing details.
- Buyer selected first-role prepay and asks how the prepaid credit applies after a membership or billing change.
- Buyer opened a first role but says the prepaid credit was not applied or was tied to the wrong billing account.

### Support action

1. Locate the purchase row.
2. Copy the support summary.
3. Confirm receipt of the request without promising the outcome.
4. Escalate to the approved billing/admin owner.
5. If first-role prepay is involved, include whether the credit is unused or used, the used role id if present, and the billing client shown in Admin Public Purchases.
6. Keep the buyer updated after the billing/admin review completes.

If the buyer changes membership before using the prepaid credit, client success should review and help apply or adjust the credit. Do not manually change credit records without approved escalation.

If the buyer reports that the first-role credit was not applied, first confirm whether the role was opened under the same billing account, including child entities. Escalate wrong-billing-account or credit-not-applied cases with the support summary and do not ask the buyer to pay again until review confirms it is safe.

### Do not

- Do not promise a refund, cancellation, or billing change.
- Do not edit Stripe subscriptions directly.
- Do not void agreements or cancel payment records from this workflow.
- Do not manually change first-role credit records without approved escalation.

### Suggested wording

> I received your request and will route it for billing review. We will confirm the next step after the purchase and payment status have been reviewed. I do not want to give you an incorrect answer before that review is complete.

## 15. Email delivery issue

### Symptoms

- Buyer says no email arrived.
- Email status is missing, failed, or delayed.
- Buyer has filtered inbox, spam quarantine, or typo concerns.

### Support action

1. Confirm the row status and which email is needed.
2. Use the correct resend action once if available.
3. Ask the buyer to check spam, quarantine, and blocked sender rules.
4. Wait for delivery state to update before resending again.
5. Escalate with support summary if email delivery remains missing or failed.

### Do not

- Do not send raw provider events to the buyer.
- Do not paste private links into support notes.
- Do not resend multiple email types when only one step is needed.

### Suggested wording

> I resent the correct alphaScreen email for your current setup step. Please check spam, quarantine, and any filtered inbox folders. If it still does not arrive, we will escalate the delivery check.

## 16. Webhook or payment mismatch

### Symptoms

- Buyer reports payment success, but row does not show paid or completed.
- Stripe indicators appear inconsistent with account setup.
- Checkout appears paid, but client/member setup is missing.
- Row status is unknown after payment-related activity.

### Support action

1. Refresh Admin Public Purchases.
2. Confirm status, agreement status, checkout status, payment indicators, and setup state.
3. Copy the support summary.
4. Escalate to engineering/admin billing review.
5. Tell the buyer the payment status is under review.

### Do not

- Do not inspect or paste raw webhook payloads in support notes.
- Do not manually mark payment as complete.
- Do not ask the buyer to repeat payment until review confirms it is safe.

### Suggested wording

> Your payment status is under review. We are checking the purchase record before asking you to take any additional checkout step. We will follow up once the payment and setup state are confirmed.

## 17. Escalation rules

Escalate when the safe admin action is unavailable, status signals conflict, money may have moved, identity may be wrong, or the buyer requests cancellation/refund/change handling.

### Escalate immediately for

- Paid in Stripe or reported paid, but Admin Public Purchases does not show paid, setup pending, or completed.
- Agreement signed but row still blocks checkout after refresh.
- Checkout completed but no client/member setup appears after a reasonable refresh window.
- Buyer email is wrong after signing or payment.
- Duplicate purchase rows where one or more may be paid.
- Refund, cancellation, membership change, or billing cadence change request.
- Repeated email delivery failure after one safe resend.
- Any request that would require manual database, Stripe, or agreement mutation.

### What to include

- Sanitized support summary from the row.
- Buyer email domain or redacted email when needed.
- Company name only if appropriate for internal support.
- Current status label and the buyer-reported problem.
- The recovery action already attempted and approximate time.

### What not to include

- Secrets, tokens, auth headers, webhook signing details, or raw webhook payloads.
- Full signing URLs, setup URLs, or password reset links.
- Raw provider payloads.
- Unnecessary customer private data.

## 18. Safe support language snippets

Use these snippets as a starting point. Adjust for the actual row state.

### Agreement link

> I resent the alphaScreen membership agreement to the buyer address on file. Please use the newest email to review and sign before continuing to secure checkout.

### Checkout link

> Your agreement appears to be signed. I resent the secure checkout recovery email to the buyer address on file so you can continue payment from the current signup.

### Password setup

> Payment appears complete, and the remaining step is password setup. I resent the setup email to the buyer address on file. Please use the newest email to finish account access.

### Existing account login

> This purchase appears tied to an existing alphaScreen login. Please sign in with your existing account. If the new membership is not visible, reply here and we will review the account link.

### Payment status under review

> I do not want to ask you to repeat checkout until the current payment state is verified. We are reviewing the purchase status and will follow up with the next safe step.

### Refund or cancellation request received

> I received your request and will route it for billing review. We will confirm the next step after the purchase and payment status have been reviewed.

### Escalation without promising outcome

> This needs internal review before we can safely change the purchase path. I am escalating the current status and will follow up once the account, agreement, and payment state are confirmed.

## 19. Glossary

- Purchase intent: the internal record created when a buyer starts public membership signup.
- Membership agreement: the agreement the buyer must review and sign before secure checkout.
- Stripe Checkout: the secure payment step used after agreement signing.
- Setup email: the email that helps the buyer set a password or complete account access.
- Welcome email: the email that welcomes a new alphaScreen client after activation when applicable.
- Admin Public Purchases: the admin page used to review self-serve purchase status and run allowed recovery actions.
- Support summary: sanitized row summary intended for internal escalation.
- Agreement pending: agreement has not been signed yet.
- Checkout pending: agreement is signed and payment is not complete or is still being confirmed.
- Setup pending: payment appears complete, but account or member setup is not fully linked.
- Completed: billing and member access are active and linked.
- Canceled: purchase is no longer active or checkout/payment did not continue.

## 20. Production use note

After launch, use the production Admin Public Purchases page for live customers. Do not use QA links, QA records, or QA screenshots when supporting a live buyer.

Before sending instructions, verify the domain, row status, buyer email, and current recovery action. Never paste tokens, auth headers, signing URLs, setup URLs, or raw provider data into support notes.

## Final standard

Each buyer should receive the next safe step for their current purchase state. Admin recovery actions help the buyer resume agreement, checkout, or setup. They do not replace agreement signing, payment confirmation, or account activation.
