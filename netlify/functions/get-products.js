const { google } = require('googleapis');

exports.handler = async function(event, context) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight' }) };
    }

    console.log('=== DEBUG FUNCTION START ===');
    
    try {
        // Check environment variables
        const envCheck = {
            hasClientEmail: !!process.env.GOOGLE_SHEET_CLIENT_EMAIL,
            hasPrivateKey: !!process.env.GOOGLE_SHEET_PRIVATE_KEY,
            hasSheetId: !!process.env.GOOGLE_SHEET_ID,
            clientEmailValue: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
            sheetIdValue: process.env.GOOGLE_SHEET_ID,
            privateKeyStart: process.env.GOOGLE_SHEET_PRIVATE_KEY ? process.env.GOOGLE_SHEET_PRIVATE_KEY.substring(0, 50) + '...' : 'Not found'
        };
        
        console.log('Environment variables check:', envCheck);

        if (!process.env.GOOGLE_SHEET_CLIENT_EMAIL || !process.env.GOOGLE_SHEET_PRIVATE_KEY || !process.env.GOOGLE_SHEET_ID) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing environment variables',
                    debug: envCheck
                })
            };
        }

        // Test authentication
        console.log('Testing Google Auth...');
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SHEET_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_SHEET_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        console.log('Getting auth client...');
        const authClient = await auth.getClient();
        console.log('Auth client obtained successfully');

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        console.log('Attempting to get spreadsheet info...');
        
        // Test 1: Try to get spreadsheet metadata
        try {
            const spreadsheetInfo = await sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId
            });
            
            console.log('✅ Spreadsheet metadata retrieved successfully');
            console.log('Available sheets:', spreadsheetInfo.data.sheets.map(sheet => ({
                title: sheet.properties.title,
                sheetId: sheet.properties.sheetId,
                gridProperties: sheet.properties.gridProperties
            })));

            // Test 2: Try to read data from Sheet1
            const firstSheetName = spreadsheetInfo.data.sheets[0].properties.title;
            console.log('First sheet name:', firstSheetName);

            try {
                const dataResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${firstSheetName}!A1:D10` // Just get first 10 rows for testing
                });

                console.log('✅ Data retrieved successfully');
                console.log('Rows found:', dataResponse.data.values?.length || 0);
                console.log('Sample data:', dataResponse.data.values?.slice(0, 3));

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        success: true,
                        message: 'Authentication and data retrieval successful',
                        debug: {
                            sheetsFound: spreadsheetInfo.data.sheets.length,
                            firstSheetName,
                            rowsFound: dataResponse.data.values?.length || 0,
                            sampleData: dataResponse.data.values?.slice(0, 2),
                            envCheck
                        }
                    })
                };

            } catch (dataError) {
                console.error('❌ Failed to read data:', dataError.message);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Failed to read sheet data',
                        details: dataError.message,
                        debug: { envCheck, spreadsheetAccessible: true }
                    })
                };
            }

        } catch (spreadsheetError) {
            console.error('❌ Failed to access spreadsheet:', spreadsheetError.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Failed to access spreadsheet',
                    details: spreadsheetError.message,
                    possibleCauses: [
                        'Sheet ID is incorrect',
                        'Sheet is not shared with service account',
                        'Service account lacks permissions'
                    ],
                    debug: envCheck
                })
            };
        }

    } catch (error) {
        console.error('❌ General error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Authentication or setup error',
                details: error.message,
                stack: error.stack?.substring(0, 500)
            })
        };
    }
};
