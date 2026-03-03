import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getGelatoClient } from '@/lib/gelato';

/**
 * GET handler for searching actual Gelato products
 * This endpoint searches Gelato's catalog for valid products
 */
export async function GET(request: NextRequest) {
  // Check authentication using Firebase Auth
  const authResponse = await requireAuth(request);
  if (authResponse) {
    return authResponse;
  }

  try {
    const gelatoClient = getGelatoClient();
    
    // First, get available catalogs
    console.log('Fetching available catalogs...');
    const catalogs = await gelatoClient.getCatalogs();
    console.log('Available catalogs:', catalogs.map(c => c.uid));
    
    // Search for products in each catalog to find posters
    const allProducts = [];
    
    for (const catalog of catalogs) {
      try {
        console.log(`Searching products in catalog: ${catalog.uid}`);
        const products = await gelatoClient.searchProducts(catalog.uid, 50, 0);
        
        // Filter for poster-like products
        const posterProducts = products.filter(product => {
          const uid = product.uid.toLowerCase();
          const name = product.name?.toLowerCase() || '';
          
          // Look for flat posters (not canvas, apparel, etc.)
          return uid.includes('flat_') && 
                 (uid.includes('12x16') || uid.includes('16x20') || uid.includes('18x24') || uid.includes('24x36')) &&
                 (uid.includes('170-gsm') || uid.includes('200-gsm'));
        });
        
        console.log(`Found ${posterProducts.length} poster products in ${catalog.uid}`);
        
        allProducts.push(...posterProducts.map(p => ({
          ...p,
          catalog: catalog.uid
        })));
        
      } catch (error) {
        console.warn(`Failed to search catalog ${catalog.uid}:`, error);
      }
    }
    
    console.log(`Total poster products found: ${allProducts.length}`);
    
    // Format results for easier reading
    const formattedProducts = allProducts.map(product => ({
      uid: product.uid,
      name: product.name,
      catalog: product.catalog,
      attributes: product.attributes
    }));
    
    return NextResponse.json({ 
      totalFound: formattedProducts.length,
      products: formattedProducts 
    });
    
  } catch (error: any) {
    console.error('Failed to search products:', error);
    return NextResponse.json(
      { error: `Failed to search products: ${error.message}` },
      { status: 500 }
    );
  }
}
