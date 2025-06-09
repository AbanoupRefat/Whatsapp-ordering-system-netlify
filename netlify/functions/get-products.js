const { google } = require('googleapis');

exports.handler = async function(event, context) {
    try {
        console.log('Function started, method:', event.httpMethod);
        console.log('Headers:', JSON.stringify(event.headers));
        
        // Clean and format the private key properly
        let privateKey = process.env.GOOGLE_SHEET_PRIVATE_KEY;
        
        // Remove any extra whitespace and ensure proper line breaks
        if (privateKey) {
            privateKey = privateKey
                .replace(/\\n/g, '\n')  // Replace literal \n with actual newlines
                .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
                .replace(/-----BEGIN PRIVATE KEY----- /g, '-----BEGIN PRIVATE KEY-----\n')
                .replace(/ -----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----')
                .replace(/-----BEGIN PRIVATE KEY-----\n\s+/, '-----BEGIN PRIVATE KEY-----\n')
                .replace(/\s+\n-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        
        // First, get the spreadsheet metadata to find available sheets
        const spreadsheetInfo = await sheets.spreadsheets.get({
            spreadsheetId,
        });
        
        // Get the first sheet name (or you can specify a particular sheet)
        const firstSheet = spreadsheetInfo.data.sheets[0];
        const sheetName = firstSheet.properties.title;
        
        console.log('Available sheets:', spreadsheetInfo.data.sheets.map(s => s.properties.title));
        console.log('Using sheet:', sheetName);
        
        const range = `${sheetName}!A:D`; // Using the actual sheet name, columns A to D (الفئة, البند, المنشأ, السعر)

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        console.log('Raw rows received:', rows ? rows.length : 0);
        console.log('First few rows:', rows ? rows.slice(0, 3) : 'No rows');
        
        if (!rows || rows.length === 0) {
            console.log('No data found, returning empty products array');
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                },
                body: JSON.stringify({ products: [], message: 'No data found' }),
            };
        }

        const headers = rows[0]; // Assuming first row is headers
        console.log('Headers:', headers);
        
        const products = [];
        let currentCategory = '';

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Check if it's a separator row (all values are empty)
            if (row.every(cell => !cell || cell.trim() === '')) {
                products.push({ isSeparator: true });
                continue;
            }

            // Assuming headers are: الفئة, البند, المنشأ, السعر
            const product = {
                category: row[0] || '',
                name: row[1] || '',
                origin: row[2] || '',
                price: row[3] || '',
            };

            products.push(product);
        }

        console.log('Total products processed:', products.length);
        console.log('Sample products:', products.slice(0, 2));

        const result = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
            body: JSON.stringify({ 
                products,
                totalCount: products.length,
                sheetName: sheetName,
                success: true
            }),
        };
        
        console.log('Returning response with status:', result.statusCode);
        return result;

    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error.message);
        console.error('Full error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
            body: JSON.stringify({ 
                error: 'Failed to fetch data from Google Sheets', 
                details: error.message,
                success: false,
                // Don't log sensitive info in production
                ...(process.env.NODE_ENV !== 'production' && { fullError: error.toString() })
            }),
        };
    }
};
