import axios from 'axios';

interface FlareSolverrResponse {
  solution: {
    response: string;
  };
  status: string;
  message: string;
  session?: string;
}

export class FlareSolverrClient {
  private apiUrl: string;
  private session: string | null = null;

  constructor() {
    this.apiUrl = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
  }

  async createSession(): Promise<void> {
    const { data } = await axios.post<FlareSolverrResponse>(
      this.apiUrl,
      { cmd: 'sessions.create' },
      { timeout: 10000 }
    );
    
    if (data.status === 'ok' && data.session) {
      this.session = data.session;
    }
  }

  async destroySession(): Promise<void> {
    if (!this.session) return;
    
    try {
      await axios.post(this.apiUrl, {
        cmd: 'sessions.destroy',
        session: this.session
      }, { timeout: 5000 });
      this.session = null;
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async fetchPage(url: string): Promise<string> {
    try {
      const requestBody: any = {
        cmd: 'request.get',
        url,
        maxTimeout: 60000
      };

      if (this.session) {
        requestBody.session = this.session;
      }

      const { data } = await axios.post<FlareSolverrResponse>(
        this.apiUrl,
        requestBody,
        { timeout: 65000 }
      );

      if (data.status !== 'ok') {
        throw new Error(`FlareSolverr failed: ${data.message}`);
      }

      return data.solution.response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new Error('FlareSolverr not running');
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { data } = await axios.get(`${this.apiUrl}`, { timeout: 5000 });
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }
}

let instance: FlareSolverrClient | null = null;

export function getFlareSolverr(): FlareSolverrClient {
  if (!instance) {
    instance = new FlareSolverrClient();
  }
  return instance;
}
