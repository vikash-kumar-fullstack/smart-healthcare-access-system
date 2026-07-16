/**
 * OAuth provider validation helper with support for Google PKCE
 */
export const verifySocialProvider = async (provider, tokenOrCode, codeVerifier = "") => {
  // If Google client ID is configured, perform real Google OAuth verification
  if (provider === "google" && process.env.GOOGLE_CLIENT_ID) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5173/oauth/callback";

    try {
      // Exchange code for token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: tokenOrCode,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: codeVerifier
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Google token exchange error: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token } = tokenData;

      // Fetch profile
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        throw new Error(`Google profile fetch error: ${errorText}`);
      }

      const profile = await userResponse.json();
      if (!profile.email) {
        throw new Error("Unable to retrieve email from Google profile.");
      }

      return {
        email: profile.email,
        name: profile.name || profile.given_name || "Google User",
        providerId: profile.sub,
        avatar: profile.picture || null
      };
    } catch (err) {
      throw new Error(`Google OAuth exchange failed: ${err.message}`);
    }
  }

  // Fallback to mock simulation
  if (tokenOrCode.includes("@")) {
    const mockEmail = tokenOrCode.toLowerCase();
    const mockName = mockEmail.split("@")[0].replace(/[._-]/g, " ");
    return {
      email: mockEmail,
      name: mockName.charAt(0).toUpperCase() + mockName.slice(1),
      providerId: `oauth_${provider}_${Math.random().toString(36).substring(2, 10)}`,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${mockEmail}`
    };
  }

  return {
    email: "showcase-social@example.com",
    name: "Showcase Social User",
    providerId: `oauth_${provider}_99999`,
    avatar: null
  };
};
