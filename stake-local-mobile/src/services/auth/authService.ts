import { engine } from '../demo/runtime';
export interface Session {
  userId: string;
  token: string;
  expiresAt: string;
}
class AuthService {
  private session(userId: string): Session {
    return {
      userId,
      token: 'local-demo',
      expiresAt: '2099-01-01T00:00:00.000Z'
    };
  }
  async getUserId() {
    return (await engine.snapshot()).sessionId || null;
  }
  async getSession() {
    const id = await this.getUserId();
    return id ? this.session(id) : null;
  }
  async isAuthenticated() {
    return !!(await this.getUserId());
  }
  async devSignIn(id = 'dev_user_1') {
    await engine.switchAccount(id);
    return this.session(id);
  }
  async login(username: string) {
    const s = await engine.snapshot();
    const a = s.accounts.find(a => a.username.toLowerCase() === username.trim().toLowerCase());
    if (!a) throw Error('Local account not found');
    return this.devSignIn(a.id);
  }
  async register(username: string) {
    const a = await engine.register(username, true);
    return this.session(a.id);
  }
  async logout() {
    await engine.switchAccount();
  }
}
export const authService = new AuthService();
