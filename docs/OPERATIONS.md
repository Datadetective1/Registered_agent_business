# Operations runbook: manual fulfillment

This is how one person runs the business day to day while orders are fulfilled by hand through the wholesale partner's dashboard.

## Daily routine (about 15 minutes)

1. Open **Admin → Dashboard**.
2. Work the **Ready for fulfillment** list, oldest first (see below).
3. Check **Customer responses to review**. Answer them, or move the order forward.
4. Check **Paid, but onboarding not completed (3+ days)**. Send a friendly email if needed.
5. Check **Needs attention**: failed renewals and open support requests.
6. Confirm the daily job ran. **Admin → Audit log**, filter `jobs.daily`.

## Placing an order with the wholesale partner

1. Open the order: **Admin → Orders → #number**.
2. Copy fields from the **Provider entry sheet** into the partner dashboard.
   - Each field has a Copy button, and "Copy all" copies the whole sheet as text.
   - Never re-type data from memory. The sheet is exactly what the customer submitted.
3. Place the order in the partner dashboard and note the partner's order/reference number.
4. Back in admin, under **Update status**, choose **Submitted**.
   - Paste the reference number.
   - Optionally add an internal note.
   - Keep **Email the customer** ticked.
5. When the partner shows the order as in progress, you can move it to **Processing**. This step is optional and sends no email.

### Need more information from the customer?

- Choose **Information Needed** and write exactly what you need.
- The customer is emailed and sees the request in their account, where they can reply and upload files.
- Their reply appears on the order, and the dashboard flags it.
- Click **Mark resolved** once it's handled, then continue.

### Completing an order

1. **Upload the documents** under Documents on the order: the filed certificate, the RA confirmation, and so on.
   - Choose *Customer can see it* and tick the email notice.
2. **Registered agent orders** (including formation with our RA): choose **Completed**.
   - Enter the **registered agent name** and **registered office address** the partner assigned.
   - The customer sees these on their business page and gets an email with them.
3. **Formation orders**: completing the order marks the LLC as **Active**. Add the SOS file number and formation date on the entity page.

## When service of process or state mail arrives

1. The partner notifies you, or you see the document in the partner dashboard.
2. Open **Admin → Entities → the business**.
3. Upload the document:
   - Type: *Service of process* or *State correspondence*.
   - Visibility: *Customer*.
   - Tick **Email the customer**.
4. The customer receives an "Important" email that points them to their account. The document is never attached to the email.
5. **Admin → Documents** shows whether the customer has viewed it. If an urgent document hasn't been viewed after a day or two, call or email the customer.

Do not give legal advice about a document. If asked, say we can't advise and that they should contact an attorney promptly.

## Renewals, cancellations, refunds

- **Renewals** are charged automatically by Stripe.
  - Reminders go out 30 and 7 days before; adjust the timing in Settings.
  - Successful renewals extend the service automatically.
- **Failed renewals** show under *Needs attention*. Stripe retries the charge automatically, and the customer gets an email asking them to update their card.
- **Customer turns off auto-renewal:** you get an alert email, and the service shows *Ends at renewal date*.
  - Before the end date, check whether the partner needs any action.
  - Review the state's resignation requirements if the customer doesn't appoint a new agent.
- **Subscription ends:** you get an *[Service ended]* alert. Cancel with the partner, and follow resignation rules where they apply.
- **Cancelling an order:** set the order to **Cancelled**. Any subscription on it is cancelled immediately. No customer email is sent automatically, so contact them.
- **Refunds:**
  1. Issue the refund in the **Stripe dashboard**. The payment updates here automatically.
  2. Then set the order to **Refunded** if the whole order is refunded.

  State fees generally can't be refunded once a filing has been submitted.

## Support

- **Admin → Support** lists contact-form and in-account messages.
- Reply by email using the **Reply by email** button, then mark the request *Pending* or *Closed*.
- Internal notes on a request are never shown to customers.

## Things the system deliberately does not do (yet)

- Call the partner's API. The `ManualProvider` only produces the entry sheet.
- Send real email. While `EMAIL_TRANSPORT=log`, read messages at **Admin → Email outbox**.
- Issue refunds from inside the app. Use the Stripe dashboard.

## Adding the partner API later

See [ARCHITECTURE.md §8](ARCHITECTURE.md#8-provider-abstraction). In short:

1. Implement `FulfillmentProvider` for the partner using their documented API.
2. Register it in `src/server/providers/index.ts`.
3. Map their statuses and webhooks onto `provider_orders.status`.
4. Switch the provider in Admin → Settings.

The admin and customer workflows stay the same.
