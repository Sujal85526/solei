-- Client answers (2026-10-15): business/legal details are not published; delivery is AED 30 flat,
-- UAE only (no free-delivery threshold); returns and passport terms as written in the handover;
-- contact details come later (policies point to the Contact us page meanwhile); the site uses
-- essential cookies only. Developer notes and "to confirm" markers are removed for publishing.

update public.delivery_zones set fee_fils = 3000;
update public.settings set free_delivery_threshold_fils = null where id = 1;

update public.help_topics set updated_label = '15 October 2026'
 where slug in ('shipping', 'returns', 'terms', 'privacy');

update public.help_topics set body = $txt$Solei ("we", "us" or "our") delivers eligible orders within the United Arab Emirates. Orders are processed following successful payment and confirmation of product availability.

## Delivery locations and charges
Our standard UAE delivery fee is AED 30 per order, subject to service availability at the requested address. If a location is outside our courier coverage or an additional delivery charge is necessary, we will contact the customer before proceeding and will not apply an unapproved charge.

## Processing and delivery timing
Delivery dates are estimates and may vary because of location, courier capacity, public holidays, address accuracy or other factors outside our reasonable control. We will notify customers of material delays where possible.

## Order details and receipt
Customers must provide an accurate recipient name, phone number and delivery address. A dated order receipt will be issued with the product, quantity, price and shipping charge.

## Failed or missed delivery
If delivery cannot be completed, we will contact the customer to arrange a reasonable next step. Any additional redelivery charges will be communicated in advance and applied only where legally permitted and agreed by the customer.

## Shipping restrictions and international orders
Delivery is available within approved areas of the UAE only. International delivery is not offered. Fragrance items are transported only through courier services authorised to handle the relevant product classification.

## Contact
For delivery questions, contact us through our Contact us page. Include your order reference.$txt$
 where slug = 'shipping';

update public.help_topics set title = 'Returns, exchanges & refunds', body = $txt$We want every Solei order to arrive exactly as expected. This policy applies alongside the customer's non-excludable rights under applicable UAE consumer protection law.

## Change-of-mind requests
We accept returns or exchanges requested within seven (7) calendar days after delivery for items that remain unopened, unused, in resalable condition and in their complete original packaging, with all original seals intact. Due to the personal-use nature of fragrance products, opened, used or tampered items may not be eligible for discretionary change-of-mind returns or exchanges. This rule does not restrict legal rights where an item is defective, damaged, incorrect or misdescribed.

## Damaged, incorrect or defective items
If a product arrives damaged, is defective, or does not match what was ordered or described, contact us as soon as reasonably possible with the order number, a description and, if available, clear photographs of the product and packaging. For faster support, we recommend contacting us within 48 hours of delivery; this recommendation does not eliminate statutory rights or create a legal deadline. We will assess the issue and provide an appropriate remedy in accordance with UAE law, which may include replacement, exchange, repair where appropriate or refund.

## Return authorisation
Please contact Solei before sending an item back so our team can confirm the process and return address. Do not send items to an event venue or unconfirmed address. We will explain collection/return steps and any applicable shipping charges beforehand.

## Refund method and timing
Approved refunds are issued to the original payment method wherever possible, unless an alternative lawful method is agreed. Processing time depends on the payment processor and card issuer. In cases where we supplied an incorrect, defective or damaged product, return-related charges will be handled in accordance with applicable law.

## Non-returnable promotional items / loyalty rewards
Complimentary items and rewards are not redeemable for cash. Their handling in a return or exchange must be fair and consistent with the customer's statutory rights.

## Exclusions
We reserve only the exclusions permitted by applicable law. No part of this policy affects mandatory legal rights or remedies.$txt$
 where slug = 'returns';

update public.help_topics set body = $txt$The Solei Passport is a physical collect-and-reward concept that celebrates the destinations customers collect.

1. Customers receive a physical Solei Passport with a qualifying order of two products; a passport may also be requested.
2. Customers collect one destination sticker for each eligible Solei product purchased. Different product types each count as one sticker per item.
3. Upon collecting twelve (12) valid stickers, customers qualify for one complimentary Solei All Over Spray of their choice, subject to availability.
4. The original physical passport and/or other agreed proof of purchase must be presented for redemption. The team records redemption to prevent the same 12 stickers being used repeatedly.
5. Rewards have no cash equivalent; selection depends on stock.
6. Statutory customer rights remain unaffected. Material changes will be communicated transparently, and already-earned rewards will be handled fairly.$txt$
 where slug = 'passport';

update public.help_topics set body = $txt$This website is operated under the display brand Solei.

## Agreement and eligibility
By browsing the website or submitting an order, customers agree to these terms to the extent permitted by applicable law. Customers must provide accurate checkout information and be legally able to place orders and pay using their chosen method.

## Product information and pricing
We aim to display product names, sizes, prices, descriptions and photographs accurately. Screens and lighting may affect perceived colours. Product descriptions and fragrance notes are descriptive, not guarantees that a scent will be perceived identically by every customer. Prices are in UAE dirhams (AED). Applicable taxes and delivery charges will be disclosed before the customer confirms payment.

## Orders and payment
Placing an order is an offer to purchase. An order may be accepted following payment authorisation and stock checks. We will send an order confirmation or communicate if an item is not available. Payment is processed securely through the payment service provider shown at checkout. We do not request full card numbers or security codes over WhatsApp, email or social media.

## Availability and errors
If an item is unavailable or a material pricing or listing error is discovered after purchase, we will contact the customer promptly with suitable lawful options, including cancellation and refund where appropriate. We will not substitute a different scent without the customer's agreement.

## Delivery and risk
Delivery areas, fees, timing and the handling of missed deliveries are described in the Shipping & Delivery Policy. Rights and remedies for goods not delivered as agreed remain subject to applicable UAE law.

## Cancellations and returns
Customers may request cancellation before dispatch by contacting Solei. We will make reasonable efforts to stop shipment, but once dispatched, the Returns & Exchanges Policy applies together with applicable law.

## Intellectual property and permitted use
The Solei name, approved brand marks, imagery, text and designs on the website are owned by Solei or used under licence. Visitors may view and use the website for personal shopping, but may not reproduce its content commercially without permission. Users must not misuse checkout, interfere with security or submit fraudulent orders.

## Consumer rights and liability
Nothing in these terms removes or limits consumer rights, statutory remedies or liability that cannot lawfully be excluded. Subject to applicable law, we are not responsible for service disruption caused by events beyond our reasonable control, but will seek to resolve customer issues fairly.

## Governing law and updates
These terms are governed by applicable laws of the United Arab Emirates, without restricting mandatory consumer protections. We may update the terms and will display the effective date. Material changes will not be applied retroactively in a way that unlawfully disadvantages existing orders.$txt$
 where slug = 'terms';

update public.help_topics set body = $txt$Solei respects the privacy of customers and visitors. Solei is responsible for personal data processed through this website, subject to applicable UAE data protection and consumer protection requirements.

## Information we may collect
When a customer browses or places an order, we may collect name, contact details, delivery and billing details, purchased items, order history, support requests, device and site usage data, and marketing preferences. Payment-card details are handled by approved payment service providers and are not stored by Solei.

## Why we use information
We use personal data to process orders, organise delivery, provide customer support, prevent misuse and fraud, comply with legal obligations, maintain the website and — where an appropriate legal basis or valid consent exists — send brand updates and offers. Marketing signup is optional and separate from the ability to place an order.

## Sharing and service providers
Information may be shared with relevant suppliers acting for Solei, such as payment providers, the website platform, hosting services, fulfilment couriers, customer support tools and consented marketing services. Only information necessary for their service should be shared, under suitable safeguards. We do not sell customer data to advertisers.

## Cookies and analytics
The website uses essential cookies to operate the cart, sign-in and checkout. The Cookie Notice explains how they are used.

## Security and retention
We take reasonable technical and organisational steps to safeguard personal information. Records are retained only for as long as necessary for business operations, legal obligations, dispute resolution and other legitimate purposes, and are securely deleted or anonymised when no longer needed.

## Access, correction and requests
Customers can contact us through our Contact us page to ask about personal data, request correction or raise a privacy concern, subject to applicable law. We will respond in line with applicable requirements and may need to verify the requester's identity before acting.

## Children, international services and updates
The store is not intentionally designed to collect data from children without appropriate safeguards. Technology service providers may process data in other locations; Solei will use lawful transfer mechanisms where required. Updates to the policy will be shown on this page with an updated date.$txt$
 where slug = 'privacy';

update public.help_topics set body = $txt$Solei uses only essential technology that keeps the website working, including the cart, sign-in and security functions. These cookies are needed for the site to work and are not used for advertising.

We do not currently use analytics or marketing cookies. If that changes, this notice will be updated and you will be asked for your choice first.$txt$
 where slug = 'cookies';
