# Modern Mosaics

An AI-powered application that transforms photos into customized, high-quality posters ready for printing.

## Project Overview

Modern Mosaics uses AI to generate, edit, and upscale images into high-quality artwork that can be ordered as physical posters. The application leverages OpenAI's image generation capabilities, Replicate's ESRGAN for upscaling, Cloudinary for image storage, and Gelato for printing and fulfillment.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 App Router (React)
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js with Google authentication

### Backend
- **API Routes**: Next.js serverless API
- **AI Generation**: OpenAI gpt-image-1
- **Image Upscaling**: Replicate ESRGAN
- **Storage**: Cloudinary
- **Print Service**: Gelato API

## Getting Started

### Prerequisites
- Node.js 16.8.0 or later
- npm or yarn
- API keys for the services listed in the `.env.example` file

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/modern-mosaics.git
   cd modern-mosaics
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file based on `.env.example` and add your API keys.

4. Start the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- User authentication with Google
- AI-powered image generation and editing
- High-quality image upscaling to 4K resolution
- Streamlined ordering process for physical posters
- User dashboard to view and manage creations and orders

## Project Structure

The project follows the Next.js 14 App Router structure:

- `/src/app`: Application pages and API routes
- `/src/components`: Reusable UI components
- `/src/lib`: Utility functions and service integrations
- `/src/types`: TypeScript type definitions

## Development Roadmap

See [roadmap.md](roadmap.md) for detailed development plans and progress tracking.

## License

[MIT](LICENSE)
