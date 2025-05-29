# OAuth2 Setup Instructions

## Setting up Google OAuth2

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing one

2. **Enable Google+ API**
   - Go to "APIs & Services" > "Enable APIs and Services"
   - Search for "Google+ API" and enable it

3. **Create OAuth2 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure OAuth consent screen first:
     - Choose "External" for user type
     - Fill in app name, user support email
     - Add your email to test users
   - Application type: "Web application"
   - Name: "Stock Trading System"
   - Authorized redirect URIs:
     - For local: `http://localhost:3000/auth/google/callback`
     - For production: `https://yourdomain.com/auth/google/callback`

4. **Copy Credentials**
   - Copy the Client ID and Client Secret
   - Update `.env` file:
     ```
     GOOGLE_CLIENT_ID=your_client_id_here
     GOOGLE_CLIENT_SECRET=your_client_secret_here
     ```

5. **Update Allowed Users**
   - Edit `.env` file:
     ```
     ALLOWED_USERS=your-email@gmail.com,another-email@gmail.com
     ```

6. **Generate Session Secret**
   - Update `.env` with a random string:
     ```
     SESSION_SECRET=your_random_secret_here_32_chars_min
     ```
   - You can generate one using: `openssl rand -base64 32`

## Testing

1. Start the server: `npm start`
2. Visit: http://localhost:3000
3. You should be redirected to login page
4. Click "Sign in with Google"
5. After authentication, you'll be redirected to the main app

## Production Deployment

1. Update `.env` for production:
   ```
   NODE_ENV=production
   CALLBACK_URL=https://yourdomain.com/auth/google/callback
   ```

2. Ensure HTTPS is enabled (required for secure cookies)

3. Update Google Console with production redirect URI

## Troubleshooting

- **"Access denied" error**: Make sure your email is in ALLOWED_USERS
- **Redirect mismatch**: Ensure CALLBACK_URL matches Google Console
- **Session issues**: Check SESSION_SECRET is set and consistent