# Pretty Charm — Storefront & Admin Operations Manual

Pretty Charm is an editorial e-commerce platform for **Gift Hampers (₹299 & ₹499)**, **Hair Accessories**, and **Jewellery**, backed by a server-validated **WhatsApp-Assisted Order & Payment Workflow**, persistent SQLite storage, RBAC Admin Console, and immutable Catalogue Integrity Protection.

---

## 1. Local Development & Deployment Setup

### Prerequisites
- Node.js 20+
- npm 10+

### Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure your environment variables:
   ```bash
   cp .env.example .env
   ```
3. Start the full-stack server (Express API + Vite frontend on port `3000`):
   ```bash
   npm run dev
   ```
4. Run the automated domain logic & WhatsApp order workflow test suite:
   ```bash
   npx tsx --test src/shared/domainLogic.test.ts
   ```
5. Build for production deployment:
   ```bash
   npm run build
   npm start
   ```

---

## 2. WhatsApp-Assisted Order & Payment Workflow

### Customer Flow
1. **Browse & Add to Bag**: Customers browse active **Gift Hampers (₹299 and ₹499)**, **Hair Accessories**, and **Jewellery**, manage bag items and quantities, and proceed to checkout.
2. **Checkout Details**: Customers enter their full name, 10-digit Indian mobile number, complete delivery address (Line 1, Line 2, City, State, 6-digit Pincode), and optional delivery instructions.
3. **Server-Side Validation & Persistence**:
   - Before WhatsApp opens, `POST /api/checkout` validates product status, exact database prices, stock availability, and totals on the server.
   - A unique Order ID (e.g., `PC-2026-1001`) is created and persisted in SQLite (`data/pretty_charm.sqlite`) with:
     - `payment_status = 'pending'`
     - `order_status = 'awaiting_payment'`
4. **"Order via WhatsApp" Click-to-Chat Handoff**:
   - The order confirmation screen provides an **"Order via WhatsApp"** button that opens `https://wa.me/<storePhone>?text=...` with a URL-encoded personalized message containing the Order ID, product names, variants, quantities, item prices, total amount, customer name, mobile number, and full delivery address.
   - The UI explicitly instructs the customer: **"Important: Please press Send in WhatsApp"** and never claims that opening WhatsApp automatically submits the message.
5. **Saved Order Recovery**:
   - If the customer closes WhatsApp or returns to the website without sending the message, their saved order remains accessible directly in **My Bag**, **Checkout**, **Saved Orders**, and **Track My Order** (`POST /api/orders/track`) so they can re-open WhatsApp anytime without re-entering their address or creating duplicate orders.

### Admin Workflow (`Admin Login` -> Tab `6. Orders`)
1. **Server-Side Authentication & Authorization**:
   - Protected by HTTP-only session cookies and `requireAdmin` middleware.
   - Initial setup uses `/api/auth/bootstrap-admin` (when zero admin users exist), or signs in via `/api/auth/login`.
2. **Order Management, Search & Filtering**:
   - View all orders with Order ID, itemized products, customer details, delivery address, total amount, created timestamp, **Payment Status** (`pending` / `paid`), and **Fulfilment Status** (`awaiting_payment` / `confirmed` / `processing` / `packed` / `shipped` / `delivered`).
   - Filter orders by search query (Order ID, customer name, phone, product), Payment Status, and Fulfilment Status.
3. **Customer Contact & Payment Instructions via WhatsApp**:
   - **Copy Customer WhatsApp Link**: Copies `https://wa.me/91<customerMobile>` to clipboard.
   - **Send Payment Instructions / Link / QR via WhatsApp**: Opens a prefilled WhatsApp Click-to-Chat message to the customer containing the Order ID, exact payable amount, and configured UPI ID / Payment Link / QR Image URL.
4. **Bank-Checked Payment Verification & Audit Trail**:
   - Clicking **"Mark Payment Received (Bank Checked)"** (`POST /api/admin/orders/:id/verify-payment`) updates `payment_status` to `'paid'` while keeping `order_status` separate (`awaiting_payment` until confirmed).
   - Records `verified_by_admin_id`, `verified_by_admin_email`, and `verified_at` on the order and writes an immutable `PAYMENT_VERIFIED` entry to the Audit Log.
5. **Order Confirmation & Prefilled WhatsApp Confirmation**:
   - Once payment is verified (`payment_status === 'paid'`), the admin can click **"Confirm Order"** (`POST /api/admin/orders/:id/confirm`), which sets `order_status = 'confirmed'` and logs `ORDER_CONFIRMED` in the Audit Log.
   - Clicking **"Send Confirmation via WhatsApp"** opens the customer's WhatsApp chat with a ready-to-send confirmation message containing the Order ID, items, total paid, and confirmed status.

---

## 3. Payment Safety & Compliance Rules

- **No Fake Payment Verification**: Orders are never marked paid automatically from screenshots, unverified UTR text, WhatsApp messages, or client-side URL parameters. Payment status changes to `paid` only when an authenticated Admin verifies the actual bank/UPI statement or verified payment gateway webhook.
- **Separate Payment & Fulfilment Statuses**: `payment_status` (`pending`, `paid`, `failed`, `refunded`) and `order_status` (`awaiting_payment`, `confirmed`, `processing`, `packed`, `shipped`, `delivered`, `cancelled`) are tracked independently.
- **Merchant / Commercial UPI Eligibility Warning**: Personal or minor savings/UPI accounts must **not** be assumed approved for merchant or commercial business collections. Before accepting customer payments via UPI ID, QR code, or payment links, verify merchant/business account eligibility and commercial compliance with your bank or RBI-regulated payment aggregator.
- **Click-to-Chat vs Official WhatsApp Business Platform API**:
  - `https://wa.me/...` Click-to-Chat links only open WhatsApp with prefilled text; the user or admin must manually press **Send** inside WhatsApp.
  - Fully automated background outbound WhatsApp messages require a separately provisioned official **Meta WhatsApp Business Platform (Cloud API)** account, verified business phone number ID, permanent access token, and pre-approved Meta message templates.

---

## 4. Indian PIN Code Validation, Geolocation & Delivery Serviceability

Pretty Charm features a production-grade checkout system tailored specifically for Indian logistics, combining official postal directory verification, optional GPS geolocation, location consistency checking, and strict separation between postal validity and logistics courier serviceability.

### 4.1 Strict 6-Digit Indian PIN Code Format
- Indian PIN codes must contain **exactly 6 numeric digits** (`^[1-9][0-9]{5}$`).
- PIN codes starting with `0` or containing fewer/more than 6 digits are immediately rejected on both client and server before triggering any external API calls.

### 4.2 Official Postal Data Integration & Caching
1. **India Post Open Government Data / Postal API**:
   - Queries `https://api.postalpincode.in/pincode/${pincode}` with a custom User-Agent and a 4.5-second timeout (`AbortSignal.timeout(4500)`).
   - Retrieves genuine post office names, district, circle, and state.
2. **Persistent SQLite Caching (`postal_pincode_cache`)**:
   - Successfully verified PIN codes are cached in SQLite with post offices, district, and state.
   - Subsequent checkouts resolve instantly from local disk cache with zero external network latency and zero rate-limiting risk.
3. **Built-in Offline Postal Registry**:
   - Covers major postal hubs across all Indian zones (Delhi NCR, Mumbai, Bengaluru, Hyderabad, Kolkata, Chennai, Jaipur, Pune, Ahmedabad, Lucknow, Chandigarh, etc.).
   - Acts as a deterministic offline fallback if the external postal directory is temporarily unreachable or times out.

### 4.3 Optional GPS-Assisted Location Detection & Reverse Geocoding
1. **Explicit Tap-Only Trigger**:
   - The **"Use My Current Location"** button requests browser geolocation permission **only** after an explicit customer tap.
   - GPS permission is **never** requested automatically on page load.
2. **Graceful Handling of Denial / Failure**:
   - If location permission is denied (`PERMISSION_DENIED`) or times out, a non-blocking informative banner is displayed, and the customer seamlessly enters their address manually.
3. **Reverse Geocoding via OpenStreetMap Nominatim**:
   - Coordinates are resolved via OpenStreetMap Nominatim with zoom 18 and address details.
   - Automatically populates estimated PIN code, street, locality, city, district, and state.
4. **Data Privacy Policy (No Coordinate Storage)**:
   - Precise GPS coordinates (`latitude`, `longitude`) are evaluated transiently in memory for postal resolution and are **never** stored or persisted in database orders or customer records.
5. **Mandatory Residence Disclosure Notice**:
   - The UI and API explicitly display: *"GPS and PIN code matching estimate your geographic area for courier routing, but do not prove residence at the entered address. Please verify your exact house/flat and street number."*

### 4.4 Address & PIN Code Inconsistency Detection
- `detectPinCodeLocationMismatch()` checks the entered PIN code against the entered district and state.
- If a customer enters a PIN code from Karnataka (e.g. `560001`) with state "Delhi", an alert banner warns:
  > **Location Inconsistency Detected**: PIN code `560001` officially corresponds to Bengaluru / Karnataka, but "Delhi" is selected.
- Provides a one-click **"Auto-correct to [District], [State]"** button that updates the form with a single tap.

### 4.5 Comprehensive 8-Part Indian Delivery Address
To minimize courier RTO (Return to Origin) and lost parcels, checkout collects:
1. `fullName`: Recipient full name
2. `mobile`: 10-digit Indian mobile number starting with 6, 7, 8, or 9
3. `houseFlat`: House / Flat / Building / Apartment name & number
4. `street`: Street / Road / Lane name
5. `locality`: Locality / Sector / Area name
6. `landmark`: Optional nearby landmark (e.g. Opposite Apollo Pharmacy)
7. `city`: City / Town
8. `district`: District (auto-filled from PIN, editable)
9. `state`: State / Union Territory (dropdown of all 36 Indian states and UTs)
10. `pincode`: Validated 6-digit Indian PIN code
11. `selectedPostOffice`: Nearest delivery post office (when multiple post offices exist for the PIN)
12. `deliveryInstructions`: Optional gift message or gate instructions

### 4.6 Postal Validity vs. Delivery Serviceability Separation
- **Postal Validity**: Confirms the geographic existence of the PIN code in India Post records.
- **Delivery Serviceability**: Governs whether our contracted courier partners deliver to that area and whether Cash on Delivery (COD) is supported.
- **Admin Management (Tab 11: Shipping & PIN Codes)**:
  - **Delivery Policy Mode**: Switch between **Pan-India Dispatch** (all valid PINs serviceable by default) and **Restricted Whitelist Only**.
  - **COD Eligibility Rules**: All Serviceable PINs, Whitelist Only, or Disabled (Prepaid Only).
  - **Live Postal Lookup on Add**: When adding new PIN codes in the Admin Panel, clicking **"Verify"** auto-fetches genuine district and state details from India Post OGD.
  - **Instant Toggles**: One-click toggle buttons to activate/deactivate delivery serviceability or COD for any PIN code.

### 4.7 Mobile-First Responsive Design & Viewport Verification
- Optimized and tested across standard mobile viewports:
  - **360px** (Compact Android)
  - **375px** (iPhone SE)
  - **390px** (iPhone 13 / 14 / 15)
  - **430px** (iPhone 14 / 15 Pro Max)
- Ensures zero horizontal scroll (`overflow-x: hidden`), touch-friendly 44px+ tap targets, clear typography hierarchy, and accessible form inputs.
