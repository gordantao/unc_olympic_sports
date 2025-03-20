import { Buffer } from 'buffer';
import * as dotenv from 'dotenv';

dotenv.config();

const auth_url: string = 'https://security.valdperformance.com/connect/token';
const clientId: string = process.env.CLIENT_ID!;
const clientSecret: string = process.env.CLIENT_SECRET!;

/**
 * Authenticates client with VALD API and returns an authentication token,
 * which should be passed in the `"Authorization"` header of outgoing
 * VALD API `POST` requests. Each token is valid for two hours.
 * @param clientId VALD client id.
 * @param clientSecret VALD client secret.
 * @returns VALD authentication token.
 */
export async function authenticate(): Promise<string> {
  let secret: string = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(
    auth_url,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: 'grant_type=client_credentials',
    }
  );

  const data = await response.json();
  const token = `Bearer ${data.access_token}`;
  return token;
}

function main() {
  authenticate().then((token) => console.log("Token:", token));
}

if (require.main === module) {
  main();
}