const { google } = require('googleapis');

exports.handler = async function(event, context) {
    try {
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
        const range = 'Sheet1!A:D'; // Assuming your data is in Sheet1, columns A to D (الفئة, البند, المنشأ, السعر)

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ products: [] }),
            };
        }

        const headers = rows[0]; // Assuming first row is headers
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Adjust for production security if needed
            },
            body: JSON.stringify({ products }),
        };

    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error.message);
        console.error('Full error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch data from Google Sheets', 
                details: error.message,
                // Don't log sensitive info in production
                ...(process.env.NODE_ENV !== 'production' && { fullError: error.toString() })
            }),
        };
    }
};
