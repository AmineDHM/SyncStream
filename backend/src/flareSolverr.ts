import axios from 'axios';

interface FlareSolverrResponse {
  solution: {
    url: string;
    status: number;
    cookies: any[];
    userAgent: string;
    response: string;
  };
  status: string;
  message: string;
}

export class FlareSolverrClient {
  private apiUrl: string;
  private maxTimeout: number;

  constructor() {
    this.apiUrl = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
    this.maxTimeout = 60000;
  }

  async fetchWithBypass(url: string): Promise<string> {
    console.log(`[FlareSolverr] Fetching: ${url}`);

    try {
      const response = await axios.post<FlareSolverrResponse>(
        this.apiUrl,
        {
          cmd: 'request.get',
          url: url,
          maxTimeout: this.maxTimeout
        },
        {
          timeout: this.maxTimeout + 5000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data.status === 'ok' && response.data.solution) {
        console.log(`[FlareSolverr] ✅ Success (${response.data.solution.response.length} bytes)`);
        return response.data.solution.response;
      }

      throw new Error(`FlareSolverr failed: ${response.data.message}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('FlareSolverr not running. Start with: docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest');
        }
        throw new Error(`FlareSolverr error: ${error.message}`);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}`, { timeout: 5000 });
      return response.data?.status === 'ok';
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
