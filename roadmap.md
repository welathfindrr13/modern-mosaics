# Modern Mosaics: AI Photo-to-Poster App

```
Browser ──► Next.js API route
              │
              ├─► OpenAI gpt-image-1  (generate / edit)  ─┐
              │                                           │
              ├─► Replicate ESRGAN  (up-scale to 4K)     ─┤  ===>  final PNG
              │                                           │
              └─► Cloudinary  (store + CDN)  ◄────────────┘
                        │
                        └─► Gelato Print API  (poster order)
```

## Technology Stack

### Frontend (User Interface & Experience)
- **Framework**: Next.js 14 App Router (React)
  - Fast, SEO-friendly, supports server-side rendering
- **Styling**: Tailwind CSS
  - Rapid, responsive, utility-first styling
- **Authentication**: NextAuth.js
  - Secure user authentication with Google

### Backend (Business Logic, AI Processing & Order Management)
- **API Routes**: Next.js serverless API
- **AI Generation**: OpenAI gpt-image-1
  - Generates and edits images
- **Image Upscaling**: Replicate ESRGAN
  - Upscales images to 4K resolution
- **Storage**: Cloudinary
  - Image hosting and CDN delivery
- **Print Service**: Gelato API
  - Physical poster printing and fulfillment

## Environment Variables
```
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Google Authentication
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Replicate
REPLICATE_API_TOKEN=your_replicate_api_token

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_UPLOAD_PRESET=modern_mosaics

# Gelato
GELATO_API_KEY=your_gelato_api_key
GELATO_PARTNER_ID=your_gelato_partner_id
```

## 5-Session Build Plan

### Session 1: Project Setup & Authentication ✅
**Objective:** Scaffold the Next.js 14 App Router project structure and implement authentication.

**Completed:**
- [x] Created new Next.js 14 project with TypeScript and Tailwind CSS
- [x] Set up project folder structure
- [x] Created middleware.ts for authentication protection
- [x] Implemented NextAuth with Google authentication
- [x] Created basic UI components (Button)
- [x] Built responsive layout components (Header, Footer)
- [x] Set up session provider for authentication state
- [x] Created signin page with Google authentication
- [x] Added dashboard page with protected route
- [x] Created home page with welcome message and sign-in button

**Files Created/Edited:**
- package.json - Added dependencies
- .env.local - Set up authentication variables
- middleware.ts - Auth middleware
- src/app/layout.tsx - Main layout with auth provider
- src/app/page.tsx - Homepage
- src/app/api/auth/[...nextauth]/route.ts - NextAuth config
- src/app/auth/signin/page.tsx - Sign-in page
- src/components/ui/button.tsx - Button component
- src/components/layout/header.tsx, footer.tsx - Layout components
- src/components/providers/session-provider.tsx - NextAuth provider
- src/lib/auth.ts - Auth utilities
- src/types/next-auth.d.ts - TypeScript definitions for NextAuth

### Session 2: Image Generation & Editing 🔄
**Objective:** Implement OpenAI gpt-image-1 integration for AI image generation and editing.

**Tasks:**
- [ ] Set up OpenAI client
- [ ] Create image generation API route
- [ ] Create image editing API route
- [ ] Build UI for prompt input and generation options
- [ ] Implement image upload functionality

**Files to Create/Edit:**
- .env.local - Add OpenAI API key
- src/lib/openai.ts - OpenAI client setup
- src/api/images/generate/route.ts - Image generation endpoint
- src/api/images/edit/route.ts - Image editing endpoint
- src/api/images/upload/route.ts - Temporary image upload
- src/app/create/page.tsx - Create page UI
- src/app/create/generate/page.tsx - AI generation page
- src/components/images/canvas.tsx - Image editor component
- src/components/images/uploader.tsx - Image upload component

**External Requirements:**
- OpenAI API key (requires sign-up)

### Session 3: Image Processing & Storage 📋
**Objective:** Implement Replicate ESRGAN for image upscaling and Cloudinary for storage and serving.

**Tasks:**
- [ ] Set up Replicate client for ESRGAN
- [ ] Set up Cloudinary integration
- [ ] Create upscaling API route
- [ ] Implement image storage and retrieval
- [ ] Build UI for viewing processed images

**Files to Create/Edit:**
- .env.local - Add Replicate and Cloudinary credentials
- src/lib/replicate.ts - Replicate client setup
- src/lib/cloudinary.ts - Cloudinary client setup
- src/api/images/upscale/route.ts - ESRGAN upscaling endpoint
- src/app/create/preview/page.tsx - Preview page for processed images
- src/components/images/gallery.tsx - Image gallery component
- src/models/image.ts - Image type definitions

**External Requirements:**
- Replicate API token (requires sign-up)
- Cloudinary account (cloud name, API key, API secret)

### Session 4: Order Management 📋
**Objective:** Integrate with Gelato API for poster printing and implement order management.

**Tasks:**
- [ ] Set up Gelato client
- [ ] Create order creation API route
- [ ] Implement order status checking
- [ ] Build UI for product selection and checkout
- [ ] Create order confirmation flow

**Files to Create/Edit:**
- .env.local - Add Gelato credentials
- src/lib/gelato.ts - Gelato client setup
- src/api/orders/create/route.ts - Order creation endpoint
- src/api/orders/status/route.ts - Order status endpoint
- src/app/order/page.tsx - Order summary page
- src/app/order/checkout/page.tsx - Checkout page
- src/app/order/confirmation/page.tsx - Order confirmation page
- src/components/orders/product-options.tsx - Product selection component
- src/components/orders/shipping-form.tsx - Shipping details form
- src/models/order.ts - Order type definitions

**External Requirements:**
- Gelato API key and partner ID (requires partner account)

### Session 5: UI/UX Refinement & Dashboard 📋
**Objective:** Build the user dashboard, add final UI polish, and implement comprehensive error handling.

**Tasks:**
- [ ] Enhance user dashboard for viewing previous creations and orders
- [ ] Implement comprehensive error boundaries
- [ ] Add loading states and animations
- [ ] Polish responsive design and accessibility
- [ ] Final testing and bug fixes

**Files to Create/Edit:**
- src/app/dashboard/page.tsx - Dashboard enhancements
- src/app/dashboard/layout.tsx - Dashboard layout
- src/app/error.tsx - Global error boundary
- src/app/loading.tsx - Global loading state
- src/app/dashboard/loading.tsx - Dashboard loading state
- src/components/ui/ - Additional UI components for polish

## Sanity Checklist

- [x] Project structure set up correctly
- [x] Authentication working with Google OAuth
- [x] Protected routes properly redirecting
- [ ] Image generation with OpenAI
- [ ] Image upscaling with ESRGAN
- [ ] Cloudinary storage integration
- [ ] Gelato order integration
- [ ] Dashboard showing user content
- [ ] Complete end-to-end flow (create → upscale → order)

## Future Enhancements (Post-MVP)

### AR & 3D Previews
- Three.js with WebXR for AR previews
- Interactive 3D elements for poster visualization

### Additional Integrations
- Database: PostgreSQL with Prisma ORM
- Job Queue: Redis with BullMQ for background processing

### Deployment
- Frontend: Vercel
- Backend services: AWS EC2 (if needed beyond Next.js API routes)
- CI/CD: GitHub Actions

### Analytics & Monitoring
- Sentry for error tracking
- LogRocket for user analytics
