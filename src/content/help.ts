/**
 * Help centre (English) — policy wording verbatim from the client's website handover (§04).
 * Square-bracket items are details the client still has to confirm; they render as a visible
 * "to confirm" marker until filled in. Sentences addressed to the developer are left out.
 */
export type HelpBlock = { heading?: string; paragraphs?: string[]; list?: string[] };
export type HelpTopic = {
  key: string;
  title: string;
  updated?: string;
  intro?: string;
  blocks: HelpBlock[];
};

export const helpCopy = {
  meta: {
    title: "Help",
    description:
      "Shipping and delivery, returns and refunds, the Solei Passport, terms of service, privacy and cookies.",
  },
  eyebrow: "Help centre",
  title: "Solei support",
  lede: "Have a question about your order, a destination or the Solei Passport? We are here to help. Reach us using the details below and include your order number if your message is about a purchase.",
  contact: "Contact us",
  track: "Track your order",
  updated: "Last updated",
  toConfirm: "To confirm",
};

export const helpTopics: HelpTopic[] = [
  {
    key: "shipping",
    title: "Shipping & delivery",
    updated: "[date of publication]",
    intro:
      "Solei (“we”, “us” or “our”) delivers eligible orders within the United Arab Emirates. Orders are processed following successful payment and confirmation of product availability.",
    blocks: [
      {
        heading: "Delivery locations and charges",
        paragraphs: [
          "Our standard UAE delivery fee is AED 30 per order, subject to service availability at the requested address. If a location is outside our courier coverage or an additional delivery charge is necessary, we will contact the customer before proceeding and will not apply an unapproved charge.",
        ],
      },
      {
        heading: "Processing and delivery timing",
        paragraphs: [
          "Orders are normally prepared within [CONFIRM BUSINESS-DAY PROCESSING WINDOW]. Estimated transit time is [CONFIRM COURIER DELIVERY WINDOW], measured from dispatch rather than order placement. Delivery dates are estimates and may vary because of location, courier capacity, public holidays, address accuracy or other factors outside our reasonable control. We will notify customers of material delays where possible.",
        ],
      },
      {
        heading: "Order details and receipt",
        paragraphs: [
          "Customers must provide an accurate recipient name, phone number and delivery address. A dated order receipt will be issued with the product, quantity, price and shipping charge. Where required, the invoice will include Arabic information and our licensed business details.",
        ],
      },
      {
        heading: "Failed or missed delivery",
        paragraphs: [
          "If delivery cannot be completed, we will contact the customer to arrange a reasonable next step. Any additional redelivery charges will be communicated in advance and applied only where legally permitted and agreed by the customer.",
        ],
      },
      {
        heading: "Shipping restrictions and international orders",
        paragraphs: [
          "At launch, delivery is available within approved areas of the UAE only. International delivery is not offered unless expressly made available at checkout. Fragrance items are transported only through courier services authorised to handle the relevant product classification.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          "For delivery questions, contact us at [BUSINESS EMAIL] or [BUSINESS WHATSAPP]. Include your order reference.",
        ],
      },
    ],
  },
  {
    key: "returns",
    title: "Returns & refunds",
    updated: "[date of publication]",
    intro:
      "We want every Solei order to arrive exactly as expected. This policy applies alongside the customer’s non-excludable rights under applicable UAE consumer protection law.",
    blocks: [
      {
        heading: "Change-of-mind requests",
        paragraphs: [
          "We propose accepting returns or exchanges requested within seven (7) calendar days after delivery for items that remain unopened, unused, in resalable condition and in their complete original packaging, with all original seals intact. Due to the personal-use nature of fragrance products, opened, used or tampered items may not be eligible for discretionary change-of-mind returns or exchanges. This rule does not restrict legal rights where an item is defective, damaged, incorrect or misdescribed. [FOUNDER: APPROVE/AMEND 7-DAY PERIOD AND ELIGIBILITY BEFORE PUBLICATION.]",
        ],
      },
      {
        heading: "Damaged, incorrect or defective items",
        paragraphs: [
          "If a product arrives damaged, is defective, or does not match what was ordered or described, contact us as soon as reasonably possible with the order number, a description and, if available, clear photographs of the product and packaging. For faster support, we recommend contacting us within 48 hours of delivery; this recommendation does not eliminate statutory rights or create a legal deadline. We will assess the issue and provide an appropriate remedy in accordance with UAE law, which may include replacement, exchange, repair where appropriate or refund.",
        ],
      },
      {
        heading: "Return authorisation",
        paragraphs: [
          "Please contact Solei before sending an item back so our team can confirm the process and return address. Do not send items to an event venue or unconfirmed address. We will explain collection/return steps and any applicable shipping charges beforehand.",
        ],
      },
      {
        heading: "Refund method and timing",
        paragraphs: [
          "Approved refunds are issued to the original payment method wherever possible, unless an alternative lawful method is agreed. Processing time depends on the payment processor and card issuer. Expected refund timelines: [CONFIRM AFTER PAYMENT GATEWAY SETUP]. In cases where we supplied an incorrect, defective or damaged product, return-related charges will be handled in accordance with applicable law.",
        ],
      },
      {
        heading: "Non-returnable promotional items / loyalty rewards",
        paragraphs: [
          "Complimentary items and rewards are not redeemable for cash. Their handling in a return or exchange must be fair and consistent with the customer’s statutory rights. [CONFIRM GIFT ADJUSTMENT MECHANISM.]",
        ],
      },
      {
        heading: "Exclusions",
        paragraphs: [
          "We reserve only the exclusions permitted by applicable law. No part of this policy affects mandatory legal rights or remedies.",
        ],
      },
    ],
  },
  {
    key: "passport",
    title: "Solei Passport terms",
    intro:
      "The Solei Passport is a physical collect-and-reward concept that celebrates the destinations customers collect.",
    blocks: [
      {
        list: [
          "Customers receive a physical Solei Passport with a qualifying order of two products; a passport may also be requested. [CONFIRM if qualification is two products in one order, or two lifetime purchases.]",
          "Customers collect one destination sticker for each eligible Solei product purchased. Different product types each count as one sticker per item.",
          "Upon collecting twelve (12) valid stickers, customers qualify for one complimentary Solei All Over Spray of their choice, subject to availability.",
          "The original physical passport and/or other agreed proof of purchase must be presented for redemption. The team records redemption to prevent the same 12 stickers being used repeatedly. [CONFIRM tracking method.]",
          "Rewards have no cash equivalent; selection depends on stock. Delivery fees for a reward, eligibility of refunded products and any expiry terms: [FOUNDER APPROVAL REQUIRED].",
          "Statutory customer rights remain unaffected. Material changes will be communicated transparently, and already-earned rewards will be handled fairly.",
        ],
      },
    ],
  },
  {
    key: "terms",
    title: "Terms of service",
    updated: "[date of publication]",
    intro:
      "This website is operated by [LICENSED LEGAL ENTITY], trading under the display brand Solei. Our contact address is [PUBLIC BUSINESS ADDRESS], and our contact email is [BUSINESS EMAIL]. Our commercial licence is issued by [LICENSING AUTHORITY] under number [LICENCE NUMBER].",
    blocks: [
      {
        heading: "Agreement and eligibility",
        paragraphs: [
          "By browsing the website or submitting an order, customers agree to these terms to the extent permitted by applicable law. Customers must provide accurate checkout information and be legally able to place orders and pay using their chosen method.",
        ],
      },
      {
        heading: "Product information and pricing",
        paragraphs: [
          "We aim to display product names, sizes, prices, descriptions and photographs accurately. Screens and lighting may affect perceived colours. Product descriptions and fragrance notes are descriptive, not guarantees that a scent will be perceived identically by every customer. Prices are in UAE dirhams (AED). Applicable taxes and delivery charges will be disclosed before the customer confirms payment.",
        ],
      },
      {
        heading: "Orders and payment",
        paragraphs: [
          "Placing an order is an offer to purchase. An order may be accepted following payment authorisation and stock checks. We will send an order confirmation or communicate if an item is not available. Payment is processed securely through the payment service provider shown at checkout. We do not request full card numbers or security codes over WhatsApp, email or social media.",
        ],
      },
      {
        heading: "Availability and errors",
        paragraphs: [
          "If an item is unavailable or a material pricing or listing error is discovered after purchase, we will contact the customer promptly with suitable lawful options, including cancellation and refund where appropriate. We will not substitute a different scent without the customer’s agreement.",
        ],
      },
      {
        heading: "Delivery and risk",
        paragraphs: [
          "Delivery areas, fees, timing and the handling of missed deliveries are described in the Shipping & Delivery Policy. Rights and remedies for goods not delivered as agreed remain subject to applicable UAE law.",
        ],
      },
      {
        heading: "Cancellations and returns",
        paragraphs: [
          "Customers may request cancellation before dispatch by contacting Solei. We will make reasonable efforts to stop shipment, but once dispatched, the Returns & Exchanges Policy applies together with applicable law.",
        ],
      },
      {
        heading: "Intellectual property and permitted use",
        paragraphs: [
          "The Solei name, approved brand marks, imagery, text and designs on the website are owned by Solei or used under licence. Visitors may view and use the website for personal shopping, but may not reproduce its content commercially without permission. Users must not misuse checkout, interfere with security or submit fraudulent orders.",
        ],
      },
      {
        heading: "Consumer rights and liability",
        paragraphs: [
          "Nothing in these terms removes or limits consumer rights, statutory remedies or liability that cannot lawfully be excluded. Subject to applicable law, we are not responsible for service disruption caused by events beyond our reasonable control, but will seek to resolve customer issues fairly.",
        ],
      },
      {
        heading: "Governing law and updates",
        paragraphs: [
          "These terms are governed by applicable laws of the United Arab Emirates, without restricting mandatory consumer protections. We may update the terms and will display the effective date. Material changes will not be applied retroactively in a way that unlawfully disadvantages existing orders.",
        ],
      },
    ],
  },
  {
    key: "privacy",
    title: "Privacy policy",
    updated: "[date of publication]",
    intro:
      "Solei respects the privacy of customers and visitors. [LICENSED LEGAL ENTITY] is responsible for personal data processed through this website, subject to applicable UAE data protection and consumer protection requirements.",
    blocks: [
      {
        heading: "Information we may collect",
        paragraphs: [
          "When a customer browses or places an order, we may collect name, contact details, delivery and billing details, purchased items, order history, support requests, device and site usage data, and marketing preferences. Payment-card details are handled by approved payment service providers according to the checkout integration.",
        ],
      },
      {
        heading: "Why we use information",
        paragraphs: [
          "We use personal data to process orders, organise delivery, provide customer support, prevent misuse and fraud, comply with legal obligations, maintain the website and — where an appropriate legal basis or valid consent exists — send brand updates and offers. Marketing signup must be optional and separate from the ability to place an order.",
        ],
      },
      {
        heading: "Sharing and service providers",
        paragraphs: [
          "Information may be shared with relevant suppliers acting for Solei, such as payment providers, the website platform, hosting services, fulfilment couriers, customer support tools and consented marketing services. Only information necessary for their service should be shared, under suitable safeguards. We do not sell customer data to advertisers.",
        ],
      },
      {
        heading: "Cookies and analytics",
        paragraphs: [
          "The website may use essential cookies to operate carts and checkout, and additional analytics or marketing technologies only where enabled and lawfully permitted. The separate Cookie Notice explains active categories and customer choices.",
        ],
      },
      {
        heading: "Security and retention",
        paragraphs: [
          "We take reasonable technical and organisational steps to safeguard personal information. Records are retained only for as long as necessary for business operations, legal obligations, dispute resolution and other legitimate purposes, and are securely deleted or anonymised when no longer needed. Specific retention periods: [SET USING YOUR ACTUAL PLATFORM AND ACCOUNTING REQUIREMENTS].",
        ],
      },
      {
        heading: "Access, correction and requests",
        paragraphs: [
          "Customers can contact [PRIVACY EMAIL] to ask about personal data, request correction or raise a privacy concern, subject to applicable law. We will respond in line with applicable requirements and may need to verify the requester’s identity before acting.",
        ],
      },
      {
        heading: "Children, international services and updates",
        paragraphs: [
          "The store is not intentionally designed to collect data from children without appropriate safeguards. Technology service providers may process data in other locations; Solei will use lawful transfer mechanisms where required. Updates to the policy will be shown on this page with an updated date.",
        ],
      },
    ],
  },
  {
    key: "cookies",
    title: "Cookie notice",
    blocks: [
      {
        paragraphs: [
          "Solei uses essential technology that keeps the website working, including cart and security functions. With appropriate choices and lawful permissions, the website may also use analytics to understand visits and marketing cookies to measure relevant campaigns. Visitors can manage optional choices through [COOKIE PREFERENCE TOOL].",
        ],
      },
    ],
  },
];
