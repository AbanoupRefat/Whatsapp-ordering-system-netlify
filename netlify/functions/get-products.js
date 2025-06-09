const { google } = require('googleapis');

exports.handler = async function(event, context) {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_SHEET_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        const range = 'Sheet1!A:D';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ products: [] }),
            };
        }

        const products = [];
        let currentCategory = '';
        const seenProducts = new Set(); // Track unique products

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip empty rows - add separator
            if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
                products.push({ 
                    isSeparator: true,
                    id: `separator_${i}` // Unique ID for separators
                });
                continue;
            }

            const category = row[0] ? row[0].trim() : '';
            const name = row[1] ? row[1].trim() : '';
            const origin = row[2] ? row[2].trim() : '';
            const priceStr = row[3] ? row[3].toString().trim() : '0';

            // Skip rows with missing essential data
            if (!name || !origin) {
                continue;
            }

            // Parse price
            let price = 0;
            if (priceStr) {
                const numPrice = parseFloat(priceStr.replace(/[^\d.]/g, ''));
                price = isNaN(numPrice) ? 0 : numPrice;
            }

            // Update current category if this row has a category
            if (category) {
                currentCategory = category;
            }

            // Create unique identifier for the product (name + origin + price)
            const productKey = `${name}_${origin}_${price}`;
            
            // Skip if we've already seen this exact product
            if (seenProducts.has(productKey)) {
                console.log(`Skipping duplicate product: ${name} (${origin}) - ${price}`);
                continue;
            }

            seenProducts.add(productKey);

            const product = {
                id: productKey, // Unique ID for each product
                category: currentCategory || 'غير مصنف',
                name: name,
                origin: origin,
                price: price.toString(),
                isSeparator: false
            };

            products.push(product);
        }

        console.log(`Processed ${products.length} items (including separators)`);
        console.log(`Unique products: ${products.filter(p => !p.isSeparator).length}`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ products }),
        };

    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error.message);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ 
                error: 'Failed to fetch data from Google Sheets', 
                details: error.message 
            }),
        };
    }
};
