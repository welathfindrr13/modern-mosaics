import { NextRequest, NextResponse } from 'next/server';
import gelatoPosterSkus from '@/data/gelatoPosterSkus';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET handler for fetching curated Gelato products
 * This endpoint fetches detailed information about each product in our curated list
 */
export async function GET(request: NextRequest) {
  // Check authentication using Firebase Auth
  const authResponse = await requireAuth(request);
  if (authResponse) {
    // If requireAuth returns a response, it means auth failed
    return authResponse;
  }

  // Verify Gelato API key is available
  const apiKey = process.env.GELATO_API_KEY;
  if (!apiKey) {
    console.error('Gelato API Key is missing from environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Gelato API key is missing' },
      { status: 500 }
    );
  }

  // Fetch details for each product in our curated list
  const fetchPromises = gelatoPosterSkus.map(async (skuItem) => {
    try {
      const response = await fetch(
        `https://product.gelatoapis.com/v3/products/${skuItem.uid}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Use warn for 404s to make it easier to identify and prune dead SKUs
          console.warn(`SKU not found: ${skuItem.uid}`);
        } else {
          console.error(`Failed to fetch product ${skuItem.uid}: ${response.status} ${response.statusText}`);
        }
        return null; // Skip this product
      }

      const data = await response.json();
      
      // Extract the relevant information from the response
      const basePrice = data.prices?.[0]?.price;
      const thumbnailUrl = data.attributes?.Images?.[0]?.url;
      const productName = data.attributes?.ProductName || skuItem.name;

      return {
        uid: skuItem.uid,
        name: productName,
        thumbnailUrl,
        ...(basePrice && { basePrice }),
      };
    } catch (error) {
      console.error(`Error fetching product ${skuItem.uid}:`, error);
      return null; // Skip this product
    }
  });

  // Wait for all fetch operations to complete
  const productResults = await Promise.all(fetchPromises);
  
  // Filter out null results (failed fetches)
  const products = productResults.filter(product => product !== null);

  // Return the formatted product list
  return NextResponse.json({ products });
}
