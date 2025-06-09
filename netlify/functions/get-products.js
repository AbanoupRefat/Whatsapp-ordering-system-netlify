const { google } = require('googleapis');

exports.handler = async function(event, context) {
    // Add CORS headers for all responses
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight' })
        };
    }

    console.log('Function started');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Event path:', event.path);
    console.log('Environment variables check:', {
        hasClientEmail: !!process.env.GOOGLE_SHEET_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_SHEET_PRIVATE_KEY,
        hasSheetId: !!process.env.GOOGLE_SHEET_ID
    });

    try {
        // Check if required environment variables exist
        if (!process.env.GOOGLE_SHEET_CLIENT_EMAIL || !process.env.GOOGLE_SHEET_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
            console.error('Missing required environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing required environment variables',
                    required: ['GOOGLE_SHEET_CLIENT_EMAIL', 'GOOGLE_SHEET_PRIVATE_KEY', 'GOOGLE_SHEET_ID']
                })
            };
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_SHEET_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const range = 'Sheet1!A:D';

        console.log('Attempting to fetch from Google Sheets...');
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        console.log('Raw rows received:', rows?.length || 0);
        
        if (!rows || rows.length === 0) {
            console.log('No data found in spreadsheet');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ products: [] }),
            };
        }

        console.log('First few rows:', rows.slice(0, 3));
        const headers_row = rows[0];
        console.log('Headers:', headers_row);
        
        const products = [];
        let currentCategory = '';

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Check if it's a separator row (all values are empty or whitespace)
            if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
                products.push({ isSeparator: true });
                continue;
            }

            // Create product object
            const product = {
                category: row[0] || currentCategory || '',
                name: row[1] || '',
                origin: row[2] || '',
                price: row[3] || '0',
            };

            // Update current category if this row has a category
            if (row[0] && row[0].trim()) {
                currentCategory = row[0].trim();
            }

            products.push(product);
        }

        console.log('Total products processed:', products.length);
        console.log('Sample products:', products.slice(0, 2));
        console.log('Returning response with status: 200');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                products,
                meta: {
                    total: products.length,
                    timestamp: new Date().toISOString()
                }
            }),
        };
    } catch (error) {
        console.error('Error in function:', error);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to fetch data from Google Sheets', 
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }),
        };
    }
};
