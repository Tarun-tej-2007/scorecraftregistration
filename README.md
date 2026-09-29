# SCORECRAFT Registration Website

A responsive event registration website inspired by the supplied SCORECRAFT poster for:

**Product Design and Market Driven Innovation**  
October 3rd & 4th, 2026  
Admin Block Seminar Hall  
Registration Fee: ₹250/-

## Included

- Poster-inspired visual system
- Responsive landing page
- Workshop overview and flow
- Registration form
- Registration success screen
- Demo registration API
- Demo admin dashboard at `/admin`
- CSV export of the browser's demo registration
- Mobile navigation
- Paper/grain/sketch aesthetic

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Admin demo:

```text
http://localhost:3000/admin
```

## Important: production registration

The included API is intentionally a demo endpoint. It does not permanently store registrations and it does not process real payments.

For the actual event, connect:

- PostgreSQL
- Prisma
- Razorpay or another payment gateway
- Server-side validation
- Admin authentication
- Email confirmation
- QR code generation
- CSV/export endpoint

Recommended production flow:

```text
Registration form
      ↓
Server validation
      ↓
Create pending registration
      ↓
Razorpay order
      ↓
Payment
      ↓
Verify signature server-side
      ↓
Mark registration PAID
      ↓
Generate registration ID + QR
      ↓
Send confirmation email
```

Do not mark a participant as paid from a client-side success callback alone.

## Customization

Most visual values are in:

`app/globals.css`

The event content and registration fields are in:

`components/ScorecraftSite.tsx`

The demo API is in:

`app/api/register/route.ts`

## Deployment

This project can be deployed to Vercel after replacing the demo persistence/payment logic with a real database and payment provider.

