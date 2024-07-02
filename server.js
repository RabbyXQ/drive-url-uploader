const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const url = require('url');
const axios = require('axios');
const bodyParser = require('body-parser');
const { OAuth2 } = google.auth;

const app = express();
const port = process.env.PORT || 3000;

// Your OAuth 2.0 credentials
const CLIENT_ID = 'ID';
const CLIENT_SECRET = 'SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// Path to your credentials.json
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// OAuth2 client setup
const oauth2Client = new OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Scope for Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(express.static('public'));

// Step 1: Generate the authorization URL
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// Step 2: Handle the OAuth 2.0 callback and exchange code for tokens
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to a file or database for later use
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(tokens, null, 2));

    res.send('Authorization successful! You can now upload files.');
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Error retrieving access token');
  }
});

// Step 3: Upload a file to Google Drive
app.post('/upload', async (req, res) => {
  const fileUrl = req.body.fileUrl;
  if (!fileUrl) {
    return res.status(400).send('fileUrl is required');
  }

  try {
    // Read the saved tokens
    const tokens = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    oauth2Client.setCredentials(tokens);

    // Google Drive API setup
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Download the file from the URL using axios
    const fileName = path.basename(url.parse(fileUrl).pathname);
    const response = await axios.get(fileUrl, { responseType: 'stream' });

    // Upload the file to Google Drive
    const fileMetadata = {
      name: fileName,
    };
    const media = {
      body: response.data,
    };

    const driveResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    res.status(200).send(`File uploaded successfully, file ID: ${driveResponse.data.id}`);
  } catch (error) {
    console.error('Error uploading file', error);
    res.status(500).send('Error uploading file');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
