import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'user_session';
const USER_ID_KEY = 'user_id';

export interface Session {
  userId: string;
  token: string;
  expiresAt: string;
}

class AuthService {
  async login(username: string, password: string): Promise<Session | null> {
    // Mock login - in production, this would call your API
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // For demo purposes, accept any credentials
    if (username && password) {
      const session: Session = {
        userId: '1',
        token: `mock_token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };
      
      await this.saveSession(session);
      return session;
    }
    
    return null;
  }

  async register(username: string, email: string, password: string): Promise<Session | null> {
    // Mock registration
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (username && email && password) {
      const session: Session = {
        userId: String(Date.now()), // Mock new user ID
        token: `mock_token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
      await this.saveSession(session);
      return session;
    }
    
    return null;
  }

  async saveSession(session: Session): Promise<void> {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      await SecureStore.setItemAsync(USER_ID_KEY, session.userId);
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const sessionData = await SecureStore.getItemAsync(SESSION_KEY);
      if (!sessionData) {
        return null;
      }
      
      const session: Session = JSON.parse(sessionData);
      
      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.logout();
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async getUserId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(USER_ID_KEY);
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync(USER_ID_KEY);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  // DEV ONLY: Development bypass for authentication
  // This method should be removed or disabled in production builds
  async devSignIn(userId: string = 'dev_user_1'): Promise<Session> {
    if (!__DEV__) {
      throw new Error('devSignIn should only be called in development');
    }

    const session: Session = {
      userId: userId, // Use dev_user_1 or dev_user_2 for testing
      token: 'dev_token_bypass',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };

    await this.saveSession(session);
    return session;
  }
}

export const authService = new AuthService();

